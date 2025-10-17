const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/service-provider/hotel/hotelController');
const roomController = require('../controllers/service-provider/hotel/roomController');
const authMiddleware = require('../middlewares/auth.middleware');
const { checkServiceProviderVerification } = require('../middlewares/verificationMiddleware');

// ===== HOTEL MANAGEMENT ROUTES =====
// Authentication middleware is required for all protected routes

// Provider hotel routes
router.get('/provider/:providerId/hotels', hotelController.getProviderHotels);
router.get('/provider/:providerId/hotels/:hotelId', hotelController.getHotelById);
router.get('/provider/:providerId/hotel-statistics', hotelController.getHotelStatistics);

// CREATE hotel - Requires verified 'hotel' license
router.post('/provider/:providerId/hotels', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    hotelController.createHotel
);

router.put('/provider/:providerId/hotels/:id', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    hotelController.updateHotel
);

router.delete('/provider/:providerId/hotels/:id', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    hotelController.deleteHotel
);

router.get('/provider/:providerId/hotels/:hotelId/availability', hotelController.getRoomAvailability);
router.get('/provider/:providerId/hotels/:hotelId/bookings', hotelController.getHotelBookings);

// Provider room routes
router.get('/provider/:providerId/hotels/:hotelId/rooms', roomController.getHotelRooms);
router.get('/provider/:providerId/hotels/:hotelId/rooms/:roomId', roomController.getRoomById);

// CREATE/UPDATE/DELETE room - Requires verified 'hotel' license
router.post('/provider/:providerId/hotels/:hotelId/rooms', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    roomController.createRoom
);

router.put('/provider/:providerId/hotels/:hotelId/rooms/:roomId', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    roomController.updateRoom
);

router.delete('/provider/:providerId/hotels/:hotelId/rooms/:roomId', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    roomController.deleteRoom
);

router.get('/provider/:providerId/hotels/:hotelId/rooms/:roomId/bookings', roomController.getRoomBookings);

router.put('/provider/:providerId/hotels/:hotelId/rooms/:roomId/status', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    roomController.updateRoomStatus
);

router.post('/provider/:providerId/hotels/:hotelId/rooms/:roomId/maintenance', 
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    roomController.addMaintenanceRecord
);

module.exports = router;