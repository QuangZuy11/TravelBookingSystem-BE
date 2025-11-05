const { PayOS } = require('@payos/node');
const payosConfig = require('../config/payos.config');

/**
 * Hotel Payment PayOS Service
 * Service wrapper để tương tác với PayOS API cho thanh toán đặt phòng khách sạn
 */
class HotelPaymentPayOSService {
    constructor() {
        try {
            // Validate config trước khi khởi tạo
            payosConfig.validate();

            // Khởi tạo PayOS client
            this.payOS = new PayOS(
                payosConfig.clientId,
                payosConfig.apiKey,
                payosConfig.checksumKey
            );

            console.log('✅ Hotel Payment PayOS Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize PayOS:', error.message);
            throw error;
        }
    }

    /**
     * Tạo payment link cho hotel booking
     * @param {Object} bookingData - Thông tin booking
     * @param {String} bookingData.bookingId - ID của booking
     * @param {Number} bookingData.amount - Số tiền thanh toán
     * @param {String} bookingData.description - Mô tả thanh toán
     * @param {Object} bookingData.buyerInfo - Thông tin người mua
     * @returns {Object} Payment link data
     */
    async createHotelPaymentLink(bookingData) {
        try {
            const { bookingId, amount, description, buyerInfo } = bookingData;

            // Tạo order code unique
            const orderCode = this.generateOrderCode(bookingId);

            // Tính thời gian hết hạn (2 phút)
            const expiredAt = Math.floor(Date.now() / 1000) + (payosConfig.paymentExpireMinutes * 60);

            const paymentData = {
                orderCode: orderCode,
                amount: Math.round(amount), // PayOS yêu cầu số nguyên
                description: description || `Thanh toán đặt phòng #${bookingId.slice(-8)}`,
                buyerName: buyerInfo?.name || 'Khách hàng',
                buyerEmail: buyerInfo?.email || '',
                buyerPhone: buyerInfo?.phone || '',
                buyerAddress: buyerInfo?.address || '',
                items: [
                    {
                        name: 'Đặt phòng khách sạn',
                        quantity: 1,
                        price: Math.round(amount)
                    }
                ],
                returnUrl: payosConfig.returnUrl,
                cancelUrl: payosConfig.cancelUrl,
                expiredAt: expiredAt
            };

            console.log('🔄 Creating hotel payment link...', { orderCode, amount });

            const response = await this.payOS.paymentRequests.create(paymentData);

            console.log('✅ Hotel payment link created:', response.checkoutUrl);

            return {
                success: true,
                orderCode: orderCode,
                checkoutUrl: response.checkoutUrl,
                qrCode: response.qrCode,
                paymentLinkId: response.paymentLinkId,
                amount: amount,
                expiredAt: new Date(expiredAt * 1000)
            };

        } catch (error) {
            console.error('❌ Error creating hotel payment link:', error);
            throw new Error(`Không thể tạo link thanh toán: ${error.message}`);
        }
    }

    /**
     * Kiểm tra trạng thái thanh toán
     * @param {Number} orderCode - Mã đơn hàng
     * @returns {Object} Payment info
     */
    async getHotelPaymentInfo(orderCode) {
        try {
            console.log('🔍 Checking hotel payment status...', { orderCode });

            const paymentInfo = await this.payOS.paymentRequests.get(orderCode);

            return {
                success: true,
                orderCode: paymentInfo.orderCode,
                status: paymentInfo.status,
                amount: paymentInfo.amount,
                transactions: paymentInfo.transactions || []
            };

        } catch (error) {
            console.error('❌ Error getting hotel payment info:', error);
            throw new Error(`Không thể lấy thông tin thanh toán: ${error.message}`);
        }
    }

    /**
     * Hủy payment link
     * @param {Number} orderCode - Mã đơn hàng
     * @param {String} reason - Lý do hủy
     * @returns {Object} Cancel result
     */
    async cancelHotelPayment(orderCode, reason = 'Khách hàng hủy thanh toán') {
        try {
            console.log('🔄 Cancelling hotel payment...', { orderCode, reason });

            const result = await this.payOS.paymentRequests.cancel(orderCode, reason);

            console.log('✅ Hotel payment cancelled');

            return {
                success: true,
                orderCode: result.orderCode,
                cancelledAt: new Date()
            };

        } catch (error) {
            console.error('❌ Error cancelling hotel payment:', error);
            // Không throw error vì có thể payment đã expired hoặc paid
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify webhook data từ PayOS
     * @param {Object} webhookData - Data từ webhook
     * @returns {Boolean} Valid hay không
     */
    verifyHotelPaymentWebhook(webhookData) {
        try {
            const isValid = this.payOS.verifyPaymentWebhookData(webhookData);

            if (!isValid) {
                console.warn('⚠️ Invalid hotel payment webhook signature');
            }

            return isValid;

        } catch (error) {
            console.error('❌ Error verifying hotel payment webhook:', error);
            return false;
        }
    }

    /**
     * Generate unique order code từ bookingId
     * @param {String} bookingId - MongoDB ObjectId
     * @returns {Number} Order code (số nguyên)
     */
    generateOrderCode(bookingId) {
        // Lấy 10 ký tự cuối của bookingId và convert sang số
        // PayOS yêu cầu orderCode là số nguyên dương
        const timestamp = Date.now().toString().slice(-6);
        const bookingIdSuffix = bookingId.slice(-6);

        // Kết hợp timestamp và bookingId để tạo order code unique
        const orderCode = parseInt(`${timestamp}${parseInt(bookingIdSuffix, 16).toString().slice(-6)}`);

        return orderCode;
    }

    /**
     * Parse order code để lấy lại bookingId (nếu cần)
     * Note: Vì orderCode được generate, nên cần lưu mapping trong database
     * @param {Number} orderCode 
     * @returns {String|null} Booking ID nếu tìm thấy
     */
    async getBookingIdFromOrderCode(orderCode) {
        // Cần query từ Payment model để lấy bookingId
        // Sẽ implement trong controller
        return null;
    }
}

// Export singleton instance
module.exports = new HotelPaymentPayOSService();
