const mongoose = require("mongoose");
const AdPayment = require("../models/ad-payment.model");
const AdBooking = require("../models/adbooking.model");
const adPaymentPayOSService = require("../services/ad-payment-payos.service");

/**
 * Kiểm tra trạng thái thanh toán
 * @route GET /api/ad-payments/:paymentId/status
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await AdPayment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thanh toán",
      });
    }

    // Kiểm tra quyền
    if (payment.user_id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem thanh toán này",
      });
    }

    // Nếu payment đã completed, trả về luôn
    if (payment.status === "completed") {
      return res.status(200).json({
        success: true,
        data: {
          status: payment.status,
          payment_id: payment._id,
        },
      });
    }

    // Kiểm tra với PayOS nếu có order code
    if (payment.payos_order_code) {
      try {
        const payosInfo = await adPaymentPayOSService.getAdPaymentInfo(
          payment.payos_order_code
        );

        // Cập nhật status nếu đã thay đổi
        if (payosInfo.status === "PAID" && payment.status !== "completed") {
          payment.status = "completed";
          await payment.save();

          // Cập nhật ad booking
          const adBooking = await AdBooking.findById(payment.ad_booking_id);
          if (adBooking) {
            adBooking.payment_status = "paid";
            adBooking.status = "active";
            await adBooking.save();
          }
        }
      } catch (payosError) {
        console.error("Error checking PayOS status:", payosError);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        payment_id: payment._id,
      },
    });
  } catch (error) {
    console.error("Get Payment Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra trạng thái thanh toán",
    });
  }
};

/**
 * Hủy thanh toán
 * @route POST /api/ad-payments/:paymentId/cancel
 */
exports.cancelPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await AdPayment.findById(paymentId).session(session);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thanh toán",
      });
    }

    // Kiểm tra quyền
    if (payment.user_id.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy thanh toán này",
      });
    }

    // Chỉ cho phép hủy nếu status là pending
    if (payment.status !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Không thể hủy thanh toán với trạng thái: ${payment.status}`,
      });
    }

    // Hủy payment link trên PayOS
    if (payment.payos_order_code) {
      try {
        await adPaymentPayOSService.cancelAdPayment(
          payment.payos_order_code,
          "Nhà cung cấp hủy thanh toán"
        );
      } catch (cancelError) {
        console.error("Error cancelling PayOS payment:", cancelError);
        // Vẫn tiếp tục hủy trong DB
      }
    }

    // Cập nhật payment status
    payment.status = "cancelled";
    await payment.save({ session });

    // Cập nhật ad booking
    const adBooking = await AdBooking.findById(payment.ad_booking_id).session(
      session
    );
    if (adBooking) {
      adBooking.payment_status = "cancelled";
      adBooking.status = "cancelled";
      await adBooking.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Hủy thanh toán thành công",
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Cancel Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hủy thanh toán",
    });
  } finally {
    session.endSession();
  }
};
