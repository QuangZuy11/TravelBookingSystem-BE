const express = require('express');
const router = express.Router();
const flightController = require('../controllers/flightController');

// Provider flight routes
router.get('/provider/:providerId/flights', flightController.getProviderFlights);
router.get('/provider/:providerId/flight-statistics', flightController.getFlightStatistics);
router.post('/provider/:providerId/flights', flightController.createFlight);
router.put('/provider/:providerId/flights/:id', flightController.updateFlight);
router.delete('/provider/:providerId/flights/:id', flightController.deleteFlight);
router.get('/provider/:providerId/flights/:flightId/bookings', flightController.getFlightBookings);
router.get('/provider/:providerId/flight-schedule', flightController.getFlightSchedule);

module.exports = router;