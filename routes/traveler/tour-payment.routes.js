const express = require("express");
const router = express.Router();
const tourPaymentController = require("../../controllers/traveler/tour-payment.controller");
const { authenticateUser } = require("../../middlewares/auth.middleware");

/**
 * Tour Payment Routes for Travelers
 * Tất cả routes yêu cầu authentication
 */

/**
 * @route   POST /api/traveler/tour-payments/create
 * @desc    Tạo payment link PayOS cho tour booking
 * @access  Private
 */
router.post(
  "/create",
  authenticateUser,
  tourPaymentController.createTourPayment
);

/**
 * @route   GET /api/traveler/tour-payments/:paymentId/status
 * @desc    Kiểm tra trạng thái thanh toán (polling)
 * @access  Private
 */
router.get(
  "/:paymentId/status",
  authenticateUser,
  tourPaymentController.getTourPaymentStatus
);

/**
 * @route   POST /api/traveler/tour-payments/:paymentId/cancel
 * @desc    Hủy payment khi user đóng modal
 * @access  Private
 */
router.post(
  "/:paymentId/cancel",
  authenticateUser,
  tourPaymentController.cancelTourPayment
);

/**
 * @route   GET /api/traveler/tour-payments
 * @desc    Lấy danh sách payments của user
 * @access  Private
 * @query   status (optional), page, limit
 */
router.get("/", authenticateUser, tourPaymentController.getUserTourPayments);

module.exports = router;
