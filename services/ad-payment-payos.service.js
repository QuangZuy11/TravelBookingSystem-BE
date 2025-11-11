const { PayOS } = require("@payos/node");
const payosConfig = require("../config/payos.config");

/**
 * Ad Payment PayOS Service
 * Service wrapper để tương tác với PayOS API cho thanh toán ad booking
 */
class AdPaymentPayOSService {
  constructor() {
    try {
      payosConfig.validate();

      this.payOS = new PayOS(
        payosConfig.clientId,
        payosConfig.apiKey,
        payosConfig.checksumKey
      );

      console.log("✅ Ad Payment PayOS Service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize PayOS:", error.message);
      throw error;
    }
  }

  /**
   * Tạo payment link cho ad booking
   * @param {Object} bookingData - Thông tin booking
   * @param {String} bookingData.bookingId - ID của ad booking
   * @param {Number} bookingData.amount - Số tiền thanh toán
   * @param {String} bookingData.description - Mô tả thanh toán
   * @param {Object} bookingData.buyerInfo - Thông tin người mua
   * @returns {Object} Payment link data
   */
  async createAdPaymentLink(bookingData) {
    try {
      const { bookingId, amount, description, buyerInfo } = bookingData;

      // Tạo order code unique
      const orderCode = this.generateOrderCode(bookingId);

      // Tính thời gian hết hạn (2 phút)
      const expiredAt =
        Math.floor(Date.now() / 1000) + payosConfig.paymentExpireMinutes * 60;

      const paymentData = {
        orderCode: orderCode,
        amount: Math.round(amount), // PayOS yêu cầu số nguyên
        description: description || `Quang cao tour #${bookingId.slice(-8)}`,
        buyerName: buyerInfo?.name || "Nhà cung cấp",
        buyerEmail: buyerInfo?.email || "",
        buyerPhone: buyerInfo?.phone || "",
        buyerAddress: buyerInfo?.address || "",
        items: [
          {
            name: "Quảng cáo tour",
            quantity: 1,
            price: Math.round(amount),
          },
        ],
        returnUrl: payosConfig.returnUrl,
        cancelUrl: payosConfig.cancelUrl,
        expiredAt: expiredAt,
      };

      console.log("🔄 Creating ad payment link...", { orderCode, amount });

      const response = await this.payOS.paymentRequests.create(paymentData);

      console.log("✅ Ad payment link created:", response.checkoutUrl);

      return {
        success: true,
        orderCode: orderCode,
        checkoutUrl: response.checkoutUrl,
        qrCode: response.qrCode,
        paymentLinkId: response.paymentLinkId,
        amount: amount,
        expiredAt: new Date(expiredAt * 1000),
      };
    } catch (error) {
      console.error("❌ Error creating ad payment link:", error);
      throw new Error(`Không thể tạo link thanh toán: ${error.message}`);
    }
  }

  /**
   * Kiểm tra trạng thái thanh toán
   * @param {Number} orderCode - Mã đơn hàng
   * @returns {Object} Payment info
   */
  async getAdPaymentInfo(orderCode) {
    try {
      console.log("🔍 Checking ad payment status...", { orderCode });

      const paymentInfo = await this.payOS.paymentRequests.get(orderCode);

      return {
        success: true,
        orderCode: paymentInfo.orderCode,
        status: paymentInfo.status,
        amount: paymentInfo.amount,
        transactions: paymentInfo.transactions || [],
      };
    } catch (error) {
      console.error("❌ Error getting ad payment info:", error);
      throw new Error(`Không thể lấy thông tin thanh toán: ${error.message}`);
    }
  }

  /**
   * Hủy payment link
   * @param {Number} orderCode - Mã đơn hàng
   * @param {String} reason - Lý do hủy
   * @returns {Object} Cancel result
   */
  async cancelAdPayment(orderCode, reason = "Nhà cung cấp hủy thanh toán") {
    try {
      console.log("🔄 Cancelling ad payment...", { orderCode, reason });

      const result = await this.payOS.paymentRequests.cancel(orderCode, reason);

      console.log("✅ Ad payment cancelled");

      return {
        success: true,
        orderCode: result.orderCode,
        cancelledAt: new Date(),
      };
    } catch (error) {
      console.error("❌ Error cancelling ad payment:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook data từ PayOS
   * @param {Object} webhookData - Data từ webhook
   * @returns {Boolean} Valid hay không
   */
  verifyAdPaymentWebhook(webhookData) {
    try {
      const isValid = this.payOS.verifyPaymentWebhookData(webhookData);

      if (!isValid) {
        console.warn("⚠️ Invalid ad payment webhook signature");
      }

      return isValid;
    } catch (error) {
      console.error("❌ Error verifying ad payment webhook:", error);
      return false;
    }
  }

  /**
   * Generate unique order code từ bookingId
   * @param {String} bookingId - MongoDB ObjectId
   * @returns {Number} Order code (số nguyên)
   */
  generateOrderCode(bookingId) {
    const timestamp = Date.now().toString().slice(-6);
    const bookingIdSuffix = bookingId.slice(-6);

    // Kết hợp timestamp và bookingId để tạo order code unique
    // Thêm prefix "9" để phân biệt với tour payment
    const orderCode = parseInt(
      `9${timestamp}${parseInt(bookingIdSuffix, 16).toString().slice(-5)}`
    );

    return orderCode;
  }
}

// Export singleton instance
module.exports = new AdPaymentPayOSService();
