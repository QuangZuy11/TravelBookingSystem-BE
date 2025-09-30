const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const roomController = require('../controllers/roomController');

// Provider hotel routes
router.get('/provider/:providerId/hotels', hotelController.getProviderHotels);
router.get('/provider/:providerId/hotel-statistics', hotelController.getHotelStatistics);
router.post('/provider/:providerId/hotels', hotelController.createHotel);
router.put('/provider/:providerId/hotels/:id', hotelController.updateHotel);
router.delete('/provider/:providerId/hotels/:id', hotelController.deleteHotel);
router.get('/provider/:providerId/hotels/:hotelId/availability', hotelController.getRoomAvailability);
router.get('/provider/:providerId/hotels/:hotelId/bookings', hotelController.getHotelBookings);

// Provider room routes
router.get('/provider/:providerId/hotels/:hotelId/rooms', roomController.getHotelRooms);
router.get('/provider/:providerId/hotels/:hotelId/rooms/:roomId', roomController.getRoomById);
router.post('/provider/:providerId/hotels/:hotelId/rooms', roomController.createRoom);
router.put('/provider/:providerId/hotels/:hotelId/rooms/:roomId', roomController.updateRoom);
router.delete('/provider/:providerId/hotels/:hotelId/rooms/:roomId', roomController.deleteRoom);
router.get('/provider/:providerId/hotels/:hotelId/rooms/:roomId/bookings', roomController.getRoomBookings);
router.put('/provider/:providerId/hotels/:hotelId/rooms/:roomId/status', roomController.updateRoomStatus);
router.post('/provider/:providerId/hotels/:hotelId/rooms/:roomId/maintenance', roomController.addMaintenanceRecord);

module.exports = router;