const express = require('express');
const router = express.Router();
const tourController = require('../controllers/service-provider/tour/tourController');
const tourBookingController = require('../controllers/service-provider/tour/tourBookingController');
const tourDatesController = require('../controllers/service-provider/tour/tourDatesController');
const itineraryController = require('../controllers/service-provider/tour/itineraryController');
const authMiddleware = require('../middlewares/auth.middleware');
const { checkServiceProviderVerification } = require('../middlewares/verificationMiddleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

// ===== TOUR MANAGEMENT =====
// Note: Add authentication middleware (authMiddleware) before deploying to production

// Provider Dashboard
router.get('/provider/:providerId/dashboard', tourController.getProviderDashboardStats);

// Tour CRUD - READ operations (no verification required)
router.get('/provider/:providerId/tours', tourController.getAllProviderTours);
router.get('/provider/:providerId/tours/:tourId', tourController.getTourById);

// Tour CRUD - CREATE/UPDATE/DELETE operations (require verified 'tour' license)
// Supports optional single image upload (multipart/form-data)
router.post('/provider/:providerId/tours',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    uploadMiddleware.uploadSingleImage, // Optional: handles single file if present
    uploadMiddleware.handleMulterError,
    tourController.createTour
);

router.put('/provider/:providerId/tours/:tourId',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourController.updateTour
);

router.delete('/provider/:providerId/tours/:tourId',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourController.deleteTour
);

router.patch('/provider/:providerId/tours/:tourId/status',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourController.updateTourStatus
);

// ===== TOUR DATES MANAGEMENT =====

// Add dates - Requires verification
router.post('/:tourId/dates',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourDatesController.addAvailableDate
);

router.post('/:tourId/dates/bulk',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourDatesController.addBulkDates
);

// Get dates - No verification required
router.get('/:tourId/dates', tourDatesController.getTourDates);
router.get('/:tourId/dates/:date/availability', tourDatesController.checkDateAvailability);

// Update/Delete dates - Requires verification
router.put('/:tourId/dates/:date',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourDatesController.updateDate
);

router.delete('/:tourId/dates/:date',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourDatesController.deleteDate
);

router.put('/:tourId/dates/:date/cancel',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    tourDatesController.cancelDate
);

// Search tours by date - No verification required
router.get('/search/by-date', tourDatesController.searchToursByDate);

// ===== ITINERARY MANAGEMENT =====

// Itinerary CRUD - READ operations
router.get('/:tourId/itineraries', itineraryController.getTourItineraries);
router.get('/itineraries/:id', itineraryController.getItineraryById);

// Itinerary CRUD - CREATE/UPDATE/DELETE operations (require verified 'tour' license)
router.post('/:tourId/itineraries',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    itineraryController.createItinerary
);

router.put('/itineraries/:id',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    itineraryController.updateItinerary
);

router.delete('/itineraries/:id',
    authMiddleware,
    checkServiceProviderVerification('tour'),
    itineraryController.deleteItinerary
);

// Itinerary Activities - NOW MANAGED AS SIMPLE ARRAY
// Activities are managed directly in itinerary.activities array via PUT /itineraries/:id
// No separate activity endpoints needed

// Itinerary Budget Breakdown - DISABLED (use separate budgetRoutes if needed)
// router.post('/itineraries/:id/budget', itineraryController.addBudgetBreakdown);
// router.get('/itineraries/:id/budget', itineraryController.getBudgetBreakdown);
// router.put('/itineraries/:id/budget/:budgetId', itineraryController.updateBudgetItem);  
// router.delete('/itineraries/:id/budget/:budgetId', itineraryController.deleteBudgetItem);

// ===== BOOKING MANAGEMENT =====

// Create Booking (Customer)
router.post('/bookings', tourBookingController.createTourBooking);

// Get Bookings
router.get('/bookings/my-bookings', tourBookingController.getMyBookings);
router.get('/bookings/:id', tourBookingController.getBookingById);
router.get('/bookings/provider/all', tourBookingController.getProviderBookings);

// Booking Actions
router.put('/bookings/:id/confirm', tourBookingController.confirmBooking);
router.put('/bookings/:id/cancel', tourBookingController.cancelBooking);
router.put('/bookings/:id/complete', tourBookingController.completeBooking);
router.put('/bookings/:id/payment', tourBookingController.updatePayment);

// Booking Statistics
router.get('/bookings/stats/summary', tourBookingController.getBookingStats);

// ===== LEGACY ROUTES (Keep for backward compatibility) =====

// Tour Bookings (Old)
router.get('/provider/:providerId/tours/:tourId/bookings', tourController.getTourBookings);

// Tour Reviews
router.get('/provider/:providerId/tours/:tourId/reviews', tourController.getTourReviews);

module.exports = router;
