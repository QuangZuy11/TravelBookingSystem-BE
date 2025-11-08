const mongoose = require("mongoose");
const TourPayment = require("../../models/tour-payment.model");
const TourBooking = require("../../models/tour-booking.model");
const tourPaymentPayOSService = require("../../services/tour-payment-payos.service");
const {
  sendTourBookingConfirmationEmail,
} = require("../../services/tour-booking-email.service");
const Itinerary = require("../../models/itinerary.model");

/**
 * Tour PayOS Webhook Handler
 * Xử lý callback từ PayOS khi thanh toán thành công/thất bại
 */

/**
 * Webhook endpoint để PayOS gọi khi có update về payment
 * @route POST /api/webhooks/tour-payos
 * @desc Xử lý webhook từ PayOS cho tour payment
 * @access Public (no auth, nhưng có signature verification)
 */
exports.handleTourPayOSWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("=== Tour PayOS Webhook Received ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const webhookData = req.body;

    // Verify webhook signature
    const isValid =
      tourPaymentPayOSService.verifyTourPaymentWebhook(webhookData);

    if (!isValid) {
      console.error("Invalid tour payment webhook signature");
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
    const payment = await TourPayment.findOne({
      payos_order_code: orderCode,
    }).session(session);

    if (!payment) {
      console.error("Tour payment not found for orderCode:", orderCode);
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Tìm booking
    const booking = await TourBooking.findById(payment.booking_id).session(
      session
    );

    if (!booking) {
      console.error("Tour booking not found for payment:", payment._id);
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Xử lý theo status code
    if (code === "00") {
      // Thanh toán thành công
      console.log("✓ Tour Payment SUCCESS");

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

      // Update booking status
      booking.status = "paid";
      booking.payment.status = "completed";
      booking.payment.paid_at = new Date();
      booking.payment.transaction_id = payment.transaction_ref;
      await booking.save({ session });

      console.log("✓ Tour Booking confirmed:", booking._id);
      console.log("✓ Tour Payment completed:", payment._id);

      await session.commitTransaction();

      // Send confirmation email (async, don't block response)
      try {
        const bookingWithDetails = await TourBooking.findById(booking._id)
          .populate({
            path: "tour_id",
            select: "title meeting_point",
          })
          .populate({
            path: "customer_id",
            select: "name email",
          })
          .lean();

        if (
          bookingWithDetails &&
          bookingWithDetails.tour_id &&
          bookingWithDetails.customer_id
        ) {
          // Get itineraries
          const itineraries = await Itinerary.find({
            origin_id: bookingWithDetails.tour_id._id,
            type: "tour",
          })
            .sort({ day_number: 1 })
            .lean();

          await sendTourBookingConfirmationEmail({
            customerEmail:
              bookingWithDetails.customer_id.email ||
              bookingWithDetails.contact_info?.email,
            customerName:
              bookingWithDetails.customer_id.name ||
              bookingWithDetails.contact_info?.contact_name,
            bookingNumber: bookingWithDetails.booking_number,
            tourTitle: bookingWithDetails.tour_id.title,
            tourDate: bookingWithDetails.tour_date,
            participants: bookingWithDetails.total_participants || 1,
            totalAmount:
              bookingWithDetails.pricing?.total_amount || payment.amount,
            meetingPoint: bookingWithDetails.tour_id.meeting_point,
            itineraries: itineraries,
            contactInfo: bookingWithDetails.contact_info,
          });

          console.log("✅ Tour booking confirmation email sent");
        }
      } catch (emailError) {
        console.error(
          "❌ Error sending tour booking confirmation email:",
          emailError
        );
        // Don't throw error, just log it
      }

      return res.status(200).json({
        success: true,
        message: "Webhook processed successfully",
        data: {
          payment_id: payment._id,
          booking_id: booking._id,
          status: "completed",
        },
      });
    } else {
      // Thanh toán thất bại
      console.log("✗ Tour Payment FAILED");

      // Update payment status
      payment.status = "failed";
      payment.payment_details = {
        payos_data: data,
        webhook_received_at: new Date(),
        failure_reason: desc,
      };
      await payment.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Webhook processed - payment failed",
        data: {
          payment_id: payment._id,
          booking_id: booking._id,
          status: "failed",
          reason: desc,
        },
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Tour PayOS Webhook Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Test webhook handler (development only)
 * @route POST /api/webhooks/tour-payos/test
 * @desc Test webhook handler
 * @access Public (development only)
 */
exports.testTourPayOSWebhook = async (req, res) => {
  try {
    console.log("=== Test Tour PayOS Webhook ===");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    return res.status(200).json({
      success: true,
      message: "Test webhook received",
      data: req.body,
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    return res.status(500).json({
      success: false,
      message: "Test webhook error",
      error: error.message,
    });
  }
};
