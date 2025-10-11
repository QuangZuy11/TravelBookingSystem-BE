const express = require('express');
const router = express.Router();
const tourController = require('../controllers/service-provider/tour/tourController');
const tourBookingController = require('../controllers/service-provider/tour/tourBookingController');
const tourDatesController = require('../controllers/service-provider/tour/tourDatesController');
const itineraryController = require('../controllers/service-provider/tour/itineraryController');

// ===== TOUR MANAGEMENT =====

// Provider Dashboard
router.get('/provider/:providerId/dashboard', tourController.getProviderDashboardStats);

// Tour CRUD
router.get('/provider/:providerId/tours', tourController.getAllProviderTours);
router.post('/provider/:providerId/tours', tourController.createTour);
router.get('/provider/:providerId/tours/:tourId', tourController.getTourById);
router.put('/provider/:providerId/tours/:tourId', tourController.updateTour);
router.delete('/provider/:providerId/tours/:tourId', tourController.deleteTour);
router.patch('/provider/:providerId/tours/:tourId/status', tourController.updateTourStatus);

// ===== TOUR DATES MANAGEMENT (thay the Schedule) =====

// Them available dates
router.post('/:tourId/dates', tourDatesController.addAvailableDate);
router.post('/:tourId/dates/bulk', tourDatesController.addBulkDates);

// Lay dates
router.get('/:tourId/dates', tourDatesController.getTourDates);
router.get('/:tourId/dates/:date/availability', tourDatesController.checkDateAvailability);

// Cap nhat & xoa dates
router.put('/:tourId/dates/:date', tourDatesController.updateDate);
router.delete('/:tourId/dates/:date', tourDatesController.deleteDate);
router.put('/:tourId/dates/:date/cancel', tourDatesController.cancelDate);

// Search tours by date
router.get('/search/by-date', tourDatesController.searchToursByDate);

// ===== ITINERARY MANAGEMENT =====

// Itinerary CRUD
router.post('/:tourId/itineraries', itineraryController.createItinerary);
router.get('/:tourId/itineraries', itineraryController.getTourItineraries);
router.get('/itineraries/:id', itineraryController.getItineraryById);
router.put('/itineraries/:id', itineraryController.updateItinerary);
router.delete('/itineraries/:id', itineraryController.deleteItinerary);

// Itinerary Activities
router.post('/itineraries/:id/activities', itineraryController.addActivity);
router.put('/itineraries/:id/activities/:activityId', itineraryController.updateActivity);
router.delete('/itineraries/:id/activities/:activityId', itineraryController.deleteActivity);

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
