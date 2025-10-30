const express = require('express');
const router = express.Router();
const hotelBookingController = require('../../controllers/traveler/hotel-booking.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

/**
 * @route   POST /api/traveler/bookings/reserve
 * @desc    Tạo booking tạm thời (reserved) khi user click "Đặt phòng"
 * @access  Private (User đã đăng nhập)
 * @body    {String} hotel_room_id - ID của phòng
 * @body    {Date} check_in_date - Ngày check-in
 * @body    {Date} check_out_date - Ngày check-out
 */
router.post('/reserve', authMiddleware, hotelBookingController.createReservedBooking);

/**
 * @route   POST /api/traveler/bookings/:bookingId/cancel
 * @desc    Hủy booking reserved khi user đóng modal (chưa thanh toán)
 * @access  Private (User đã đăng nhập)
 */
router.post('/:bookingId/cancel', authMiddleware, hotelBookingController.cancelReservedBooking);

/**
 * @route   GET /api/traveler/bookings/:bookingId/payment-info
 * @desc    Lấy thông tin thanh toán để hiển thị khi click button thanh toán
 * @access  Private (User đã đăng nhập)
 */
router.get('/:bookingId/payment-info', authMiddleware, hotelBookingController.getBookingPaymentInfo);

/**
 * @route   GET /api/traveler/bookings
 * @desc    Lấy danh sách booking của user
 * @access  Private
 * @query   {String} status - Trạng thái booking (pending, confirmed, cancelled)
 * @query   {Number} page - Trang hiện tại (default: 1)
 * @query   {Number} limit - Số lượng mỗi trang (default: 10)
 */
router.get('/', authMiddleware, hotelBookingController.getUserBookings);

/**
 * @route   GET /api/traveler/bookings/:bookingId
 * @desc    Lấy chi tiết một booking
 * @access  Private
 */
router.get('/:bookingId', authMiddleware, hotelBookingController.getBookingById);

module.exports = router;
