const express = require('express');
const router = express.Router();
const hotelRoomController = require('../../controllers/traveler/hotel-room.controller');

/**
 * @route   GET /api/traveler/hotels/:hotelId/rooms
 * @desc    Lấy danh sách phòng của một khách sạn và phân loại theo loại phòng
 * @access  Public
 * @query   {String} checkIn - Ngày check-in (YYYY-MM-DD)
 * @query   {String} checkOut - Ngày check-out (YYYY-MM-DD)
 * @query   {String} status - Trạng thái phòng (available, occupied, maintenance, reserved)
 * @query   {Number} minPrice - Giá tối thiểu
 * @query   {Number} maxPrice - Giá tối đa
 * @query   {Number} minCapacity - Sức chứa tối thiểu
 * @query   {String} type - Loại phòng (single, double, twin, suite, deluxe, family)
 */
router.get('/:hotelId/rooms', hotelRoomController.getRoomsByHotelId);

/**
 * @route   GET /api/traveler/hotels/:hotelId/rooms/availability
 * @desc    Kiểm tra phòng trống trong khoảng thời gian
 * @access  Public
 * @query   {String} checkIn - Ngày check-in (YYYY-MM-DD) [Required]
 * @query   {String} checkOut - Ngày check-out (YYYY-MM-DD) [Required]
 * @query   {String} roomType - Loại phòng
 * @query   {Number} capacity - Sức chứa tối thiểu
 */
router.get('/:hotelId/rooms/availability', hotelRoomController.checkRoomAvailability);

/**
 * @route   GET /api/traveler/hotels/:hotelId/rooms/types
 * @desc    Lấy danh sách loại phòng có sẵn trong khách sạn
 * @access  Public
 */
router.get('/:hotelId/rooms/types', hotelRoomController.getAvailableRoomTypes);

/**
 * @route   GET /api/traveler/rooms/:roomId
 * @desc    Lấy chi tiết một phòng theo ID
 * @access  Public
 */
router.get('/rooms/:roomId', hotelRoomController.getRoomById);

module.exports = router;
