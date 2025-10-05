const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController');

// Provider Dashboard
router.get('/provider/:providerId/dashboard', tourController.getProviderDashboardStats);

// Tour Management
router.get('/provider/:providerId/tours', tourController.getAllProviderTours);
router.post('/provider/:providerId/tours', tourController.createTour);
router.get('/provider/:providerId/tours/:tourId', tourController.getTourById);
router.put('/provider/:providerId/tours/:tourId', tourController.updateTour);
router.delete('/provider/:providerId/tours/:tourId', tourController.deleteTour);
router.patch('/provider/:providerId/tours/:tourId/status', tourController.updateTourStatus);

// Tour Bookings
router.get('/provider/:providerId/tours/:tourId/bookings', tourController.getTourBookings);

// Tour Reviews
router.get('/provider/:providerId/tours/:tourId/reviews', tourController.getTourReviews);

module.exports = router;