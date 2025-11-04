const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/auth.middleware');
const { requireProvider } = require('../../middlewares/provider-auth.middleware');
const bookingController = require('../../controllers/provider/hotel-booking-management.controller');

/**
 * Provider Hotel Booking Management Routes
 * Base URL: /api/provider/hotel-bookings
 * Tất cả routes đều yêu cầu authentication và provider role
 */

// Middleware: Yêu cầu đăng nhập + role provider
router.use(requireAuth);
router.use(requireProvider);

/**
 * @route   GET /api/provider/hotel-bookings/statistics
 * @desc    Lấy thống kê tổng quan (4 cards)
 * @access  Private (Provider only)
 * @query   start_date, end_date, hotel_id (optional)
 */
router.get('/statistics', bookingController.getStatistics);

/**
 * @route   GET /api/provider/hotel-bookings/:bookingId
 * @desc    Lấy chi tiết 1 booking
 * @access  Private (Provider only)
 */
router.get('/:bookingId', bookingController.getBookingDetail);

/**
 * @route   GET /api/provider/hotel-bookings
 * @desc    Lấy danh sách bookings (với filter & pagination)
 * @access  Private (Provider only)
 * @query   page, limit, search, booking_date, payment_status, booking_status, start_date, end_date, sort_by, order
 */
router.get('/', bookingController.getBookings);

module.exports = router;
