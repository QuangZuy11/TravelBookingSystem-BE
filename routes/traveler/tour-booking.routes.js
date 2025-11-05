const express = require("express");
const router = express.Router();
const tourBookingController = require("../../controllers/traveler/tour-booking.controller");
const { authenticateUser } = require("../../middlewares/auth.middleware");

/**
 * Tour Booking Routes for Travelers
 * Tất cả routes yêu cầu authentication
 */

/**
 * @route   POST /api/traveler/tour-bookings/reserve
 * @desc    Tạo tour booking tạm thời (reserved) khi user click "Đặt tour"
 * @access  Private
 */
router.post(
  "/reserve",
  authenticateUser,
  tourBookingController.createReservedTourBooking
);

/**
 * @route   POST /api/traveler/tour-bookings/:bookingId/cancel
 * @desc    Hủy booking khi user đóng modal (chưa thanh toán)
 * @access  Private
 */
router.post(
  "/:bookingId/cancel",
  authenticateUser,
  tourBookingController.cancelReservedTourBooking
);

/**
 * @route   GET /api/traveler/tour-bookings/:bookingId/payment-info
 * @desc    Lấy thông tin thanh toán booking để hiển thị trước khi thanh toán
 * @access  Private
 */
router.get(
  "/:bookingId/payment-info",
  authenticateUser,
  tourBookingController.getTourBookingPaymentInfo
);

/**
 * @route   GET /api/traveler/tour-bookings
 * @desc    Lấy danh sách tour bookings của user
 * @access  Private
 * @query   status (optional), page, limit
 */
router.get("/", authenticateUser, tourBookingController.getUserTourBookings);

/**
 * @route   GET /api/traveler/tour-bookings/:bookingId
 * @desc    Lấy chi tiết một tour booking
 * @access  Private
 */
router.get(
  "/:bookingId",
  authenticateUser,
  tourBookingController.getTourBookingById
);

module.exports = router;
