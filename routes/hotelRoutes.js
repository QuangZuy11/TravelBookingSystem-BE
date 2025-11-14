const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/service-provider/hotel/hotelController');
const travelerHotelController = require('../controllers/traveler/hotel.controller');
const roomController = require('../controllers/service-provider/hotel/roomController');
const authMiddleware = require('../middlewares/auth.middleware');
const { checkServiceProviderVerification } = require('../middlewares/verificationMiddleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

// ===== HOTEL MANAGEMENT ROUTES =====
// Authentication middleware is required for all protected routes

// ===== PUBLIC ROUTES (No authentication required) =====
// Get hotel details with nearby POIs - for travelers
router.get('/:hotelId/details', travelerHotelController.getHotelById);

// ===== PROVIDER ROUTES (Authentication required) =====
// Provider hotel routes
router.get('/provider/:providerId/hotels', hotelController.getProviderHotels);
router.get('/provider/:providerId/hotels/:hotelId', hotelController.getHotelById);
router.get('/provider/:providerId/hotel-statistics', hotelController.getHotelStatistics);

// CREATE hotel - Requires verified 'hotel' license
// Supports optional file upload (multipart/form-data)
router.post('/provider/:providerId/hotels',
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    uploadMiddleware.uploadMultipleImages, // Optional: handles files if present
    uploadMiddleware.handleMulterError,
    hotelController.createHotel
);

router.put('/provider/:providerId/hotels/:id',
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    uploadMiddleware.uploadMultipleImages, // Handle image uploads
    uploadMiddleware.handleMulterError,
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
router.get('/provider/:providerId/hotels/:hotelId/rooms/bookings-by-date', roomController.getBookingsByDate);
router.get('/provider/:providerId/hotels/:hotelId/rooms/:roomId', roomController.getRoomById);

// CREATE rooms in bulk - Requires verified 'hotel' license
// Supports shared image upload for all rooms
router.post('/provider/:providerId/hotels/:hotelId/rooms/bulk',
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    uploadMiddleware.uploadMultipleImages, // Handle shared images for all rooms
    uploadMiddleware.handleMulterError,
    roomController.createRoomsBulk
);

// CREATE/UPDATE/DELETE room - Requires verified 'hotel' license
// Supports optional file upload (multipart/form-data)
router.post('/provider/:providerId/hotels/:hotelId/rooms',
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    uploadMiddleware.uploadMultipleImages, // Optional: handles files if present
    uploadMiddleware.handleMulterError,
    roomController.createRoom
);

router.put('/provider/:providerId/hotels/:hotelId/rooms/:roomId',
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    uploadMiddleware.uploadMultipleImages, // Handle file uploads and form-data
    uploadMiddleware.handleMulterError,
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

// Release room from booking ("Không đến" action)
router.put('/provider/:providerId/hotels/:hotelId/bookings/:bookingId/release-room',
    authMiddleware,
    checkServiceProviderVerification('hotel'),
    roomController.releaseRoomFromBooking
);

// REMOVED: Maintenance record route - maintenanceHistory field no longer exists
// router.post('/provider/:providerId/hotels/:hotelId/rooms/:roomId/maintenance',
//     authMiddleware,
//     checkServiceProviderVerification('hotel'),
//     roomController.addMaintenanceRecord
// );

module.exports = router;