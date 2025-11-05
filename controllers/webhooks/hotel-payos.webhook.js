const mongoose = require('mongoose');
const Payment = require('../../models/hotel-payment.model');
const HotelBooking = require('../../models/hotel-booking.model');
const Room = require('../../models/room.model');
const hotelPaymentPayOSService = require('../../services/hotel-payment-payos.service');

/**
 * Hotel PayOS Webhook Handler
 * Xử lý callback từ PayOS khi thanh toán thành công/thất bại
 */

/**
 * Webhook endpoint để PayOS gọi khi có update về payment
 * @route POST /api/webhooks/hotel-payos
 * @desc Xử lý webhook từ PayOS
 * @access Public (no auth, nhưng có signature verification)
 */
exports.handleHotelPayOSWebhook = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log('=== Hotel PayOS Webhook Received ===');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(req.body, null, 2));

        const webhookData = req.body;

        // Verify webhook signature
        const isValid = hotelPaymentPayOSService.verifyHotelPaymentWebhook(webhookData);

        if (!isValid) {
            console.error('Invalid webhook signature');
            await session.abortTransaction();
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature'
            });
        }

        // Parse webhook data
        const {
            orderCode,
            code, // Mã trạng thái: "00" = success, khác = failed
            desc, // Mô tả
            data
        } = webhookData;

        console.log('Order Code:', orderCode);
        console.log('Code:', code);
        console.log('Description:', desc);

        // Tìm payment theo orderCode
        const payment = await Payment.findOne({ payos_order_code: orderCode }).session(session);

        if (!payment) {
            console.error('Payment not found for order code:', orderCode);
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Tìm booking
        const booking = await HotelBooking.findById(payment.booking_id)
            .populate('hotel_room_id')
            .session(session);

        if (!booking) {
            console.error('Booking not found:', payment.booking_id);
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Xử lý theo status code
        if (code === '00') {
            // Thanh toán thành công
            console.log('✓ Payment SUCCESS');

            // Update payment status
            payment.status = 'completed';
            payment.paid_at = new Date();
            payment.transaction_ref = data?.transactionDateTime || new Date().toISOString();
            payment.payment_details = {
                payos_data: data,
                webhook_received_at: new Date()
            };
            await payment.save({ session });

            // Update booking status
            booking.booking_status = 'confirmed';
            booking.payment_status = 'paid';
            booking.confirmed_at = new Date();
            // Clear reserve_expire_time vì đã thanh toán thành công
            booking.reserve_expire_time = null;
            await booking.save({ session });

            // Update room availability - giảm số phòng available
            const room = booking.hotel_room_id;
            if (room.available_rooms > 0) {
                room.available_rooms -= 1;
                await room.save({ session });
                console.log(`Room ${room.roomNumber} available count decreased: ${room.available_rooms + 1} -> ${room.available_rooms}`);
            }

            console.log('✓ Booking confirmed:', booking._id);
            console.log('✓ Payment completed:', payment._id);

            await session.commitTransaction();

            // TODO: Send email confirmation to user
            // TODO: Send notification to service provider

            return res.status(200).json({
                success: true,
                message: 'Webhook processed successfully',
                data: {
                    payment_id: payment._id,
                    booking_id: booking._id,
                    status: 'completed'
                }
            });

        } else {
            // Thanh toán thất bại
            console.log('✗ Payment FAILED');

            // Update payment status
            payment.status = 'failed';
            payment.failed_at = new Date();
            payment.failure_reason = desc || 'Payment failed';
            payment.payment_details = {
                payos_data: data,
                webhook_received_at: new Date(),
                error_code: code
            };
            await payment.save({ session });

            // Không cancel booking ngay, để user có thể thử lại
            // Booking sẽ tự động expire sau 2 phút bởi booking-cleanup.service

            console.log('✗ Payment failed:', payment._id);
            console.log('Reason:', desc);

            await session.commitTransaction();

            return res.status(200).json({
                success: true,
                message: 'Webhook processed - payment failed',
                data: {
                    payment_id: payment._id,
                    booking_id: booking._id,
                    status: 'failed'
                }
            });
        }

    } catch (error) {
        await session.abortTransaction();
        console.error('Hotel PayOS Webhook Error:', error);

        // Vẫn trả về 200 để PayOS không retry liên tục
        return res.status(200).json({
            success: false,
            message: 'Webhook processing error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

/**
 * Test webhook endpoint (for development)
 * @route POST /api/webhooks/hotel-payos/test
 * @desc Test webhook handler với mock data
 * @access Public (development only)
 */
exports.testHotelPayOSWebhook = async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
            success: false,
            message: 'Test endpoint only available in development'
        });
    }

    try {
        const { orderCode, success = true } = req.body;

        if (!orderCode) {
            return res.status(400).json({
                success: false,
                message: 'orderCode is required'
            });
        }

        // Mock webhook data
        const mockWebhookData = {
            orderCode: orderCode,
            code: success ? '00' : '99',
            desc: success ? 'Giao dịch thành công' : 'Giao dịch thất bại',
            data: {
                orderCode: orderCode,
                amount: 100000,
                description: 'Test payment',
                accountNumber: '12345678',
                reference: `TEST${Date.now()}`,
                transactionDateTime: new Date().toISOString(),
                currency: 'VND',
                paymentLinkId: 'test-link-id',
                code: success ? '00' : '99',
                desc: success ? 'Thành công' : 'Thất bại',
                counterAccountBankId: '',
                counterAccountBankName: '',
                counterAccountName: '',
                counterAccountNumber: '',
                virtualAccountName: '',
                virtualAccountNumber: ''
            },
            signature: 'test-signature'
        };

        console.log('=== Test Webhook ===');
        console.log('Mock Data:', JSON.stringify(mockWebhookData, null, 2));

        // Call the actual webhook handler
        req.body = mockWebhookData;
        await exports.handleHotelPayOSWebhook(req, res);

    } catch (error) {
        console.error('Test Webhook Error:', error);
        res.status(500).json({
            success: false,
            message: 'Test webhook error',
            error: error.message
        });
    }
};

module.exports = exports;
