const mongoose = require("mongoose");
const AdPayment = require("../../models/ad-payment.model");
const AdBooking = require("../../models/adbooking.model");
const adPaymentPayOSService = require("../../services/ad-payment-payos.service");

/**
 * Ad PayOS Webhook Handler
 * Xử lý callback từ PayOS khi thanh toán thành công/thất bại
 */

/**
 * Webhook endpoint để PayOS gọi khi có update về payment
 * @route POST /api/webhooks/ad-payos
 * @desc Xử lý webhook từ PayOS cho ad payment
 * @access Public (no auth, nhưng có signature verification)
 */
exports.handleAdPayOSWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("=== Ad PayOS Webhook Received ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const webhookData = req.body;

    // Verify webhook signature
    const isValid = adPaymentPayOSService.verifyAdPaymentWebhook(webhookData);

    if (!isValid) {
      console.error("Invalid ad payment webhook signature");
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // Parse webhook data
    const {
      orderCode,
      code, // Mã trạng thái: "00" = success, khác = failed
      desc, // Mô tả
      data,
    } = webhookData;

    console.log("Order Code:", orderCode);
    console.log("Code:", code);
    console.log("Description:", desc);

    // Tìm payment theo orderCode
    const payment = await AdPayment.findOne({
      payos_order_code: orderCode,
    }).session(session);

    if (!payment) {
      console.error("Ad payment not found for orderCode:", orderCode);
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Tìm ad booking
    const adBooking = await AdBooking.findById(payment.ad_booking_id).session(
      session
    );

    if (!adBooking) {
      console.error("Ad booking not found for payment:", payment._id);
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Ad booking not found",
      });
    }

    // Xử lý theo status code
    if (code === "00") {
      // Thanh toán thành công
      console.log("✓ Ad Payment SUCCESS");

      // Update payment status
      payment.status = "completed";
      payment.paid_at = new Date();
      payment.transaction_ref =
        data?.transactionDateTime || new Date().toISOString();
      payment.payment_details = {
        payos_data: data,
        webhook_received_at: new Date(),
      };
      await payment.save({ session });

      // Update ad booking status
      adBooking.payment_status = "paid";
      adBooking.status = "active";
      await adBooking.save({ session });

      await session.commitTransaction();

      console.log("✅ Ad booking activated:", adBooking._id);

      return res.status(200).json({
        success: true,
        message: "Payment processed successfully",
      });
    } else {
      // Thanh toán thất bại
      console.log("✗ Ad Payment FAILED:", desc);

      // Update payment status
      payment.status = "failed";
      payment.failed_at = new Date();
      payment.failure_reason = desc;
      await payment.save({ session });

      // Update ad booking status
      adBooking.payment_status = "failed";
      adBooking.status = "cancelled";
      await adBooking.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Payment failed",
      });
    }
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Ad PayOS Webhook Error:", error);
    res.status(500).json({
      success: false,
      message: "Webhook processing error",
    });
  } finally {
    session.endSession();
  }
};
