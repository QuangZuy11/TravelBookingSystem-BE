// Note: dotenv is already loaded in server.js, no need to load again here

/**
 * PayOS Configuration for Hotel Payment
 * Cấu hình PayOS cho thanh toán đặt phòng khách sạn
 */
module.exports = {
    // PayOS Credentials
    clientId: process.env.PAYOS_CLIENT_ID || '',
    apiKey: process.env.PAYOS_API_KEY || '',
    checksumKey: process.env.PAYOS_CHECKSUM_KEY || '',

    // Webhook URL
    webhookUrl: process.env.PAYOS_WEBHOOK_URL || '',

    // Return URLs
    returnUrl: process.env.PAYOS_RETURN_URL || 'http://localhost:3001/hotel-booking/payment/success',
    cancelUrl: process.env.PAYOS_CANCEL_URL || 'http://localhost:3001/hotel-booking/payment/cancel',

    // Payment settings
    paymentExpireMinutes: 2, // Thời gian hết hạn thanh toán (phải khớp với booking reserve time)

    // Validate configuration
    validate() {
        const missing = [];

        if (!this.clientId) missing.push('PAYOS_CLIENT_ID');
        if (!this.apiKey) missing.push('PAYOS_API_KEY');
        if (!this.checksumKey) missing.push('PAYOS_CHECKSUM_KEY');

        if (missing.length > 0) {
            throw new Error(`Missing PayOS configuration: ${missing.join(', ')}`);
        }

        return true;
    }
};
