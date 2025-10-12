const express = require('express');
const router = express.Router();
const tourController = require('../controllers/service-provider/tour/tourController');
const tourBookingController = require('../controllers/service-provider/tour/tourBookingController');
const tourDatesController = require('../controllers/service-provider/tour/tourDatesController');
const itineraryController = require('../controllers/service-provider/tour/itineraryController');
const { checkServiceProviderVerification } = require('../middlewares/verificationMiddleware');

// ===== TOUR MANAGEMENT =====
// Note: Add authentication middleware (authMiddleware) before deploying to production

// Provider Dashboard
router.get('/provider/:providerId/dashboard', tourController.getProviderDashboardStats);

// Tour CRUD - READ operations (no verification required)
router.get('/provider/:providerId/tours', tourController.getAllProviderTours);
router.get('/provider/:providerId/tours/:tourId', tourController.getTourById);

// Tour CRUD - CREATE/UPDATE/DELETE operations (require verified 'tour' license)
router.post('/provider/:providerId/tours', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourController.createTour
);

router.put('/provider/:providerId/tours/:tourId', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourController.updateTour
);

router.delete('/provider/:providerId/tours/:tourId', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourController.deleteTour
);

router.patch('/provider/:providerId/tours/:tourId/status', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourController.updateTourStatus
);

// ===== TOUR DATES MANAGEMENT =====

// Add dates - Requires verification
router.post('/:tourId/dates', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourDatesController.addAvailableDate
);

router.post('/:tourId/dates/bulk', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourDatesController.addBulkDates
);

// Get dates - No verification required
router.get('/:tourId/dates', tourDatesController.getTourDates);
router.get('/:tourId/dates/:date/availability', tourDatesController.checkDateAvailability);

// Update/Delete dates - Requires verification
router.put('/:tourId/dates/:date', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourDatesController.updateDate
);

router.delete('/:tourId/dates/:date', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    tourDatesController.deleteDate
);

router.put('/:tourId/dates/:date/cancel', 
    // authMiddleware, // TODO: Add auth middleware
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
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    itineraryController.createItinerary
);

router.put('/itineraries/:id', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    itineraryController.updateItinerary
);

router.delete('/itineraries/:id', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    itineraryController.deleteItinerary
);

// Itinerary Activities - Require verification
router.post('/itineraries/:id/activities', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    itineraryController.addActivity
);

router.put('/itineraries/:id/activities/:activityId', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    itineraryController.updateActivity
);

router.delete('/itineraries/:id/activities/:activityId', 
    // authMiddleware, // TODO: Add auth middleware
    checkServiceProviderVerification('tour'),
    itineraryController.deleteActivity
);

// Itinerary Budget Breakdown
router.post('/itineraries/:id/budget', itineraryController.addBudgetBreakdown);
router.get('/itineraries/:id/budget', itineraryController.getBudgetBreakdown);
router.put('/itineraries/:id/budget/:budgetId', itineraryController.updateBudgetItem);
router.delete('/itineraries/:id/budget/:budgetId', itineraryController.deleteBudgetItem);

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
