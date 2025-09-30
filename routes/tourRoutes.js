const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController');

// Provider tour routes
router.get('/provider/:providerId/tours', tourController.getProviderTours);
router.get('/provider/:providerId/tour-statistics', tourController.getTourStatistics);
router.post('/provider/:providerId/tours', tourController.createTour);
router.put('/provider/:providerId/tours/:id', tourController.updateTour);
router.delete('/provider/:providerId/tours/:id', tourController.deleteTour);
router.get('/provider/:providerId/tours/:tourId/bookings', tourController.getTourBookings);

module.exports = router;