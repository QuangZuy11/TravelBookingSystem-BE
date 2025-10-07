const express = require('express');
const router = express.Router();

const flightController = require('../controllers/service-provider/flight/flightController');
const flightScheduleController = require('../controllers/service-provider/flight/flightScheduleController');
const flightSeatController = require('../controllers/service-provider/flight/flightSeatController');
const flightClassController = require('../controllers/service-provider/flight/flightClassController');

// Provider flight routes
router.get('/provider/:providerId/flights', flightController.getProviderFlights);
router.get('/provider/:providerId/flights/:flightId', flightController.getFlightById);
router.get('/provider/:providerId/flight-statistics', flightController.getFlightStatistics);
router.post('/provider/:providerId/flights', flightController.createFlight);
router.put('/provider/:providerId/flights/:flightId', flightController.updateFlight);
router.delete('/provider/:providerId/flights/:flightId', flightController.deleteFlight);
router.patch('/provider/:providerId/flights/:flightId/status', flightController.updateFlightStatus);

// Flight Classes routes
router.get('/flights/:flightId/classes', flightClassController.getFlightClasses);
router.get('/flights/:flightId/classes/:classId', flightClassController.getClassById);
router.post('/flights/:flightId/classes', flightClassController.createClass);
router.put('/flights/:flightId/classes/:classId', flightClassController.updateClass);
router.delete('/flights/:flightId/classes/:classId', flightClassController.deleteClass);

// Flight Schedule routes
router.get('/flights/:flightId/schedules', flightScheduleController.getFlightSchedules);
router.get('/flights/:flightId/schedules/:scheduleId', flightScheduleController.getScheduleById);
router.post('/flights/:flightId/schedules', flightScheduleController.createSchedule);
router.put('/flights/:flightId/schedules/:scheduleId', flightScheduleController.updateSchedule);
router.delete('/flights/:flightId/schedules/:scheduleId', flightScheduleController.deleteSchedule);
router.patch('/flights/:flightId/schedules/:scheduleId/status', flightScheduleController.updateScheduleStatus);

// Flight Seat routes
router.get('/flights/:flightId/seats', flightSeatController.getFlightSeats);
router.get('/flights/:flightId/seats/available', flightSeatController.getAvailableSeats);
router.get('/flights/:flightId/seats/:seatId', flightSeatController.getSeatById);
router.post('/flights/:flightId/seats', flightSeatController.createSeat);
router.post('/flights/:flightId/seats/bulk', flightSeatController.bulkCreateSeats);
router.put('/flights/:flightId/seats/:seatId', flightSeatController.updateSeat);
router.delete('/flights/:flightId/seats/:seatId', flightSeatController.deleteSeat);
router.patch('/flights/:flightId/seats/:seatId/status', flightSeatController.updateSeatStatus);

module.exports = router;