const mongoose = require('mongoose');
const QRCode = require('qrcode');
const HotelBooking = require('../../models/hotel-booking.model');
const Payment = require('../../models/hotel-payment.model');
const hotelPaymentPayOSService = require('../../services/hotel-payment-payos.service');
const { sendHotelBookingConfirmationEmail } = require('../../services/hotel-booking-email.service');
const { createBookingSuccessNotification } = require('../../services/notification.service');
const User = require('../../models/user.model');
const Room = require('../../models/room.model');
const Hotel = require('../../models/hotel.model');

/**
 * Hotel Payment Controller
 * Xử lý thanh toán đặt phòng khách sạn qua PayOS
 */

/**
 * Tạo payment link cho hotel booking
 * @route POST /api/traveler/hotel-payments/create
 * @desc Tạo link thanh toán PayOS cho booking
 * @access Private
 */
exports.createHotelPayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { booking_id } = req.body;
        const userId = req.user._id;

        console.log('=== Create Hotel Payment ===');
        console.log('Booking ID:', booking_id);
        console.log('User ID:', userId);
        console.log('User object keys:', Object.keys(req.user));

        // Validate input
        if (!booking_id) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Thiếu booking_id'
            });
        }

        // Tìm booking
        const booking = await HotelBooking.findById(booking_id)
            .populate('hotel_room_id')
            .populate({
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: 'name'
                }
            })
            .session(session);

        if (!booking) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking'
            });
        }

        // Kiểm tra quyền
        if (booking.user_id.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thanh toán booking này'
            });
        }

        // Kiểm tra trạng thái booking - cho phép thanh toán lại nếu bị cancelled
        if (booking.booking_status === 'cancelled') {
            // Khôi phục booking từ cancelled -> reserved để cho phép thanh toán lại
            console.log('🔄 Khôi phục booking từ cancelled -> reserved');
            booking.booking_status = 'reserved';
            // Cập nhật thời gian tạo mới để có thêm 2 phút
            booking.created_at = new Date();
            await booking.save({ session });
        } else if (booking.booking_status !== 'reserved') {
            // Các trạng thái khác (confirmed, completed) không cho thanh toán
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Không thể thanh toán booking với trạng thái: ${booking.booking_status}`
            });
        }

        // Kiểm tra xem đã có payment chưa
        const existingPayment = await Payment.findOne({ booking_id: booking_id }).session(session);
        if (existingPayment && existingPayment.status === 'completed') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Booking này đã được thanh toán'
            });
        }

        // Nếu có payment pending, cancel nó
        if (existingPayment && existingPayment.status === 'pending') {
            await hotelPaymentPayOSService.cancelHotelPayment(
                existingPayment.payos_order_code,
                'Tạo payment mới'
            );
            existingPayment.status = 'cancelled';
            existingPayment.cancelled_at = new Date();
            await existingPayment.save({ session });
        }

        // Chuẩn bị data để tạo payment link
        // Nếu frontend gửi finalAmount (đã tính discount), dùng nó. Nếu không, dùng booking.total_amount
        const baseAmount = parseFloat(booking.total_amount);
        const finalAmount = req.body.finalAmount ? parseFloat(req.body.finalAmount) : baseAmount;
        
        // Validate finalAmount không được lớn hơn baseAmount
        if (finalAmount > baseAmount) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Số tiền thanh toán không hợp lệ'
            });
        }
        
        const amount = finalAmount; // Sử dụng finalAmount (đã có discount) cho PayOS
        const room = booking.hotel_room_id;

        if (!room) {
            console.error('❌ Room not found in booking:', booking_id);
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Không tìm thấy thông tin phòng'
            });
        }

        const hotel = room.hotelId;

        if (!hotel) {
            console.error('❌ Hotel not found for room:', room._id);
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Không tìm thấy thông tin khách sạn'
            });
        }

        const buyerInfo = {
            name: req.user.name || req.user.username || 'Customer',
            email: req.user.email || 'customer@example.com',
            phone: req.user.phone || req.user.phoneNumber || ''
        };

        // PayOS only allows max 25 characters for description
        const description = `Dat phong ${room.type}`.substring(0, 25);

        console.log('📞 Calling PayOS service...');
        console.log('Amount:', amount);
        console.log('Description:', description);
        console.log('Buyer:', buyerInfo);

        // Tạo payment link qua PayOS
        const paymentLinkData = await hotelPaymentPayOSService.createHotelPaymentLink({
            bookingId: booking_id,
            amount: amount,
            description: description,
            buyerInfo: buyerInfo
        });

        console.log('✅ PayOS response received:', paymentLinkData);

        // Update booking.total_amount to finalAmount (discounted amount) if different
        // This ensures booking and payment amounts are synchronized
        if (finalAmount !== baseAmount) {
            console.log(`💰 Updating booking.total_amount: ${baseAmount} -> ${finalAmount} (discount: ${baseAmount - finalAmount})`);
            booking.total_amount = finalAmount;
            await booking.save({ session });
        }

        // Tạo Payment record với amount đã giảm giá
        const newPayment = new Payment({
            booking_id: booking_id,
            user_id: userId,
            payos_order_code: paymentLinkData.orderCode,
            payos_payment_link_id: paymentLinkData.paymentLinkId,
            amount: amount, // Đã có discount
            currency: 'VND',
            method: 'qr_code', // Fixed: field name is 'method', not 'payment_method'
            description: description,
            checkout_url: paymentLinkData.checkoutUrl,
            qr_code: paymentLinkData.qrCode,
            status: 'pending',
            expired_at: paymentLinkData.expiredAt,
            metadata: {
                room_number: room.roomNumber,
                hotel_name: hotel.name,
                check_in_date: booking.check_in_date,
                check_out_date: booking.check_out_date,
                nights: booking.calculateNights(),
                original_amount: baseAmount, // Lưu giá gốc để audit
                discounted_amount: finalAmount // Lưu giá đã giảm
            }
        });

        await newPayment.save({ session });

        await session.commitTransaction();

        // Convert QR string thành base64 image
        let qrCodeBase64 = null;
        try {
            // PayOS trả về QR string, convert thành base64 image
            qrCodeBase64 = await QRCode.toDataURL(paymentLinkData.qrCode, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                width: 300
            });
            console.log('✅ QR Code converted to base64 image');
        } catch (qrError) {
            console.error('⚠️ QR Code conversion error:', qrError.message);
            // Không block response nếu QR conversion lỗi
        }

        res.status(201).json({
            success: true,
            data: {
                payment_id: newPayment._id,
                order_code: paymentLinkData.orderCode,
                checkout_url: paymentLinkData.checkoutUrl,
                qr_code: paymentLinkData.qrCode, // QR string gốc
                qr_code_base64: qrCodeBase64, // QR image base64 để hiển thị
                amount: amount,
                currency: 'VND',
                expired_at: paymentLinkData.expiredAt,
                booking: {
                    booking_id: booking._id,
                    hotel_name: hotel.name,
                    room_type: room.type,
                    room_number: room.roomNumber,
                    check_in: booking.check_in_date,
                    check_out: booking.check_out_date,
                    nights: booking.calculateNights()
                }
            },
            message: 'Tạo link thanh toán thành công. Vui lòng quét mã QR để thanh toán.'
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('❌ Create Hotel Payment Error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi tạo thanh toán',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

/**
 * Kiểm tra trạng thái thanh toán
 * @route GET /api/traveler/hotel-payments/:paymentId/status
 * @desc Polling để check trạng thái thanh toán
 * @access Private
 */
exports.getHotelPaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user._id;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy payment'
            });
        }

        // Kiểm tra quyền
        if (payment.user_id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem payment này'
            });
        }

        // Nếu đã completed hoặc failed, trả về luôn
        if (['completed', 'failed', 'cancelled', 'expired'].includes(payment.status)) {
            return res.status(200).json({
                success: true,
                data: {
                    payment_id: payment._id,
                    status: payment.status,
                    paid_at: payment.paid_at,
                    amount: payment.amount,
                    currency: payment.currency
                }
            });
        }

        // Nếu pending, convert QR code thành base64 để trả về
        let qrCodeBase64 = null;
        if (payment.qr_code && payment.status === 'pending') {
            try {
                qrCodeBase64 = await QRCode.toDataURL(payment.qr_code, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    width: 300
                });
            } catch (qrError) {
                console.error('⚠️ QR Code conversion error:', qrError.message);
            }
        }

        // Nếu pending, check từ PayOS
        try {
            const paymentInfo = await hotelPaymentPayOSService.getHotelPaymentInfo(payment.payos_order_code);

            // Update status nếu có thay đổi
            if (paymentInfo.status === 'PAID' && payment.status !== 'completed') {
                console.log('✅ Payment status is PAID, updating to completed...');
                console.log('   Payment ID:', payment._id);
                console.log('   Booking ID:', payment.booking_id);
                
                // Use transaction to ensure data consistency
                const updateSession = await mongoose.startSession();
                updateSession.startTransaction();
                
                let bookingForEmail = null;
                
                try {
                    payment.status = 'completed';
                    payment.paid_at = new Date();
                    payment.transaction_ref = paymentInfo.transactions?.[0]?.transactionDateTime || new Date().toISOString();
                    await payment.save({ session: updateSession });

                    // Update booking status
                    bookingForEmail = await HotelBooking.findById(payment.booking_id)
                        .populate('user_id')
                        .populate({
                            path: 'hotel_room_id',
                            populate: {
                                path: 'hotelId',
                                select: 'name address'
                            }
                        })
                        .session(updateSession);
                    
                    if (bookingForEmail) {
                        bookingForEmail.booking_status = 'confirmed';
                        bookingForEmail.payment_status = 'paid';
                        bookingForEmail.confirmed_at = new Date();
                        // Update total_amount to match payment amount (discounted)
                        bookingForEmail.total_amount = payment.amount;
                        bookingForEmail.reserve_expire_time = null; // Clear reserve expiry
                        await bookingForEmail.save({ session: updateSession });
                        console.log(`✅ Booking updated to confirmed: ${bookingForEmail._id}`);
                        console.log(`💰 Updated booking.total_amount to payment amount: ${payment.amount}`);

                        // Update hotel bookingsCount when payment is successful
                        const Hotel = mongoose.model('Hotel');
                        const room = bookingForEmail.hotel_room_id;
                        if (room && room.hotelId) {
                            const hotelId = room.hotelId._id || room.hotelId;
                            await Hotel.findByIdAndUpdate(
                                hotelId,
                                { $inc: { bookingsCount: 1 } },
                                { session: updateSession }
                            );
                            console.log(`📊 Updated hotel bookingsCount for hotel: ${hotelId}`);
                        }
                    } else {
                        console.error('❌ Booking not found:', payment.booking_id);
                    }
                    
                    await updateSession.commitTransaction();
                    console.log('✅ Payment and booking status updated successfully');
                    
                    // Send confirmation email (after transaction commit)
                    if (bookingForEmail && bookingForEmail.user_id && bookingForEmail.user_id.email) {
                        try {
                            const user = bookingForEmail.user_id;
                            const room = bookingForEmail.hotel_room_id;
                            const hotel = room?.hotelId;
                            
                            // Format hotel address
                            const hotelAddress = hotel?.address
                                ? [
                                    hotel.address.street,
                                    hotel.address.state,
                                    hotel.address.city
                                  ].filter(Boolean).join(', ')
                                : null;
                            
                            // Calculate nights
                            const checkIn = new Date(bookingForEmail.check_in_date);
                            const checkOut = new Date(bookingForEmail.check_out_date);
                            const diffTime = Math.abs(checkOut - checkIn);
                            const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            const emailResult = await sendHotelBookingConfirmationEmail({
                                customerEmail: user.email,
                                customerName: user.name || 'Quý khách',
                                bookingId: bookingForEmail._id.toString(),
                                hotelName: hotel?.name || 'N/A',
                                hotelAddress: hotelAddress,
                                roomNumber: room?.roomNumber || null,
                                roomType: room?.type || null,
                                checkInDate: bookingForEmail.check_in_date,
                                checkOutDate: bookingForEmail.check_out_date,
                                nights: nights,
                                totalAmount: parseFloat(bookingForEmail.total_amount),
                                paymentMethod: 'PayOS',
                                contactInfo: {
                                    phone: user.phone || null,
                                    email: user.email || null
                                }
                            });
                            
                            if (emailResult.success) {
                                console.log('✅ [POLLING] Confirmation email sent to:', user.email);
                            } else {
                                console.error('❌ [POLLING] Failed to send email:', emailResult.error);
                            }
                        } catch (emailError) {
                            console.error('❌ [POLLING] Error sending confirmation email:', emailError);
                            console.error('   Error stack:', emailError.stack);
                            // Don't fail the request if email fails
                        }

                        // Create notification for successful booking (after email sent)
                        try {
                            // Get userId from populated user object or booking
                            let userId = null;
                            if (user?._id) {
                                userId = user._id;
                            } else if (user?.id) {
                                userId = new mongoose.Types.ObjectId(user.id);
                            } else if (bookingForEmail.user_id?._id) {
                                userId = bookingForEmail.user_id._id;
                            } else if (bookingForEmail.user_id) {
                                // Convert to ObjectId if it's a string
                                userId = mongoose.Types.ObjectId.isValid(bookingForEmail.user_id)
                                    ? (bookingForEmail.user_id instanceof mongoose.Types.ObjectId 
                                        ? bookingForEmail.user_id 
                                        : new mongoose.Types.ObjectId(bookingForEmail.user_id))
                                    : null;
                            }
                            
                            const hotelName = hotel?.name || 'N/A';
                            const bookingNumber = `HB-${bookingForEmail._id.toString().slice(-6).toUpperCase()}`;
                            const amount = bookingForEmail.total_amount 
                                ? (typeof bookingForEmail.total_amount === 'object' 
                                    ? parseFloat(bookingForEmail.total_amount.toString())
                                    : parseFloat(bookingForEmail.total_amount))
                                : parseFloat(payment.amount);
                            
                            console.log('📧 [POLLING] Creating notification with data:', {
                                userId: userId ? userId.toString() : null,
                                userIdType: userId ? typeof userId : 'null',
                                userObject: user ? { _id: user._id?.toString(), id: user.id } : null,
                                bookingUserId: bookingForEmail.user_id ? { 
                                    _id: bookingForEmail.user_id._id?.toString(), 
                                    id: bookingForEmail.user_id?.toString(),
                                    type: typeof bookingForEmail.user_id
                                } : null,
                                type: 'hotel',
                                bookingId: bookingForEmail._id?.toString(),
                                bookingNumber,
                                hotelName,
                                amount
                            });
                            
                            if (!userId) {
                                console.error('❌ [POLLING] Cannot create notification - missing userId');
                                console.error('   User object:', user);
                                console.error('   Booking user_id:', bookingForEmail.user_id);
                            } else {
                                await createBookingSuccessNotification({
                                    userId: userId,
                                    type: 'hotel',
                                    bookingId: bookingForEmail._id,
                                    bookingNumber: bookingNumber,
                                    hotelName: hotelName,
                                    amount: amount
                                });
                                console.log('✅ [POLLING] Notification created successfully for booking:', bookingForEmail._id.toString());
                            }
                        } catch (notificationError) {
                            console.error('❌ [POLLING] Error creating notification:', notificationError);
                            console.error('   Error message:', notificationError.message);
                            console.error('   Error stack:', notificationError.stack);
                            // Don't fail the request if notification fails
                        }
                    } else {
                        console.warn('⚠️ [POLLING] User email not found, cannot send confirmation email');
                    }
                } catch (updateError) {
                    await updateSession.abortTransaction();
                    console.error('❌ Error updating payment/booking status:', updateError);
                    throw updateError;
                } finally {
                    updateSession.endSession();
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    payment_id: payment._id,
                    status: payment.status,
                    payos_status: paymentInfo.status,
                    paid_at: payment.paid_at,
                    amount: payment.amount,
                    currency: payment.currency,
                    checkout_url: payment.checkout_url,
                    qr_code: payment.qr_code, // QR string gốc
                    qr_code_base64: qrCodeBase64, // QR base64 image
                    expired_at: payment.expired_at
                }
            });

        } catch (error) {
            // Nếu không get được từ PayOS, trả về status hiện tại
            console.error('Error checking PayOS status:', error);
            res.status(200).json({
                success: true,
                data: {
                    payment_id: payment._id,
                    status: payment.status,
                    amount: payment.amount,
                    currency: payment.currency,
                    checkout_url: payment.checkout_url,
                    qr_code: payment.qr_code,
                    qr_code_base64: qrCodeBase64,
                    expired_at: payment.expired_at
                }
            });
        }

    } catch (error) {
        console.error('Get Payment Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi kiểm tra trạng thái thanh toán',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Hủy thanh toán
 * @route POST /api/traveler/hotel-payments/:paymentId/cancel
 * @desc Hủy payment khi user đóng modal
 * @access Private
 */
exports.cancelHotelPayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { paymentId } = req.params;
        const userId = req.user._id;

        console.log('=== Cancel Hotel Payment ===');
        console.log('Payment ID:', paymentId);

        const payment = await Payment.findById(paymentId).session(session);

        if (!payment) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy payment'
            });
        }

        // Kiểm tra quyền
        if (payment.user_id.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền hủy payment này'
            });
        }

        // Chỉ cho phép hủy payment pending
        if (payment.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Không thể hủy payment với trạng thái: ${payment.status}`
            });
        }

        // Cancel payment trên PayOS
        await hotelPaymentPayOSService.cancelHotelPayment(
            payment.payos_order_code,
            'Khách hàng hủy thanh toán'
        );

        // Update payment status
        payment.status = 'cancelled';
        payment.cancelled_at = new Date();
        await payment.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: 'Hủy thanh toán thành công',
            data: {
                payment_id: payment._id,
                status: payment.status,
                cancelled_at: payment.cancelled_at
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Cancel Hotel Payment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hủy thanh toán',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

/**
 * Lấy danh sách payments của user
 * @route GET /api/traveler/hotel-payments
 * @desc Lấy lịch sử thanh toán
 * @access Private
 */
exports.getUserHotelPayments = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { user_id: userId };

        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const payments = await Payment.find(query)
            .populate({
                path: 'booking_id',
                populate: {
                    path: 'hotel_room_id',
                    populate: {
                        path: 'hotelId',
                        select: 'name'
                    }
                }
            })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Payment.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                payments,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: payments.length,
                    totalRecords: total
                }
            }
        });

    } catch (error) {
        console.error('Get User Hotel Payments Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách thanh toán',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = exports;
