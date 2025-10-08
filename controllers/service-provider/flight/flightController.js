const mongoose = require('mongoose');
const Flight = require('../../../models/Flight');
const FlightClass = require('../../../models/FlightClass');
const FlightSchedule = require('../../../models/FlightSchedule');
const FlightSeat = require('../../../models/FlightSeat');

// Get all flights for a provider
exports.getProviderFlights = async (req, res) => {
    try {
        const flights = await Flight.find({ service_provider_id: req.params.providerId });
        
        res.status(200).json({
            success: true,
            count: flights.length,
            data: flights
        });
    } catch (error) {
        console.error('Error in getProviderFlights:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Get flight by ID
exports.getFlightById = async (req, res) => {
    try {
        const flight = await Flight.findOne({
            _id: req.params.flightId,
            service_provider_id: req.params.providerId
        });

        if (!flight) {
            return res.status(404).json({
                success: false,
                error: 'Flight not found'
            });
        }

        // Get classes for this flight
        const classes = await FlightClass.find({ flight_id: flight._id });
        
        // Get total seats
        const seats = await FlightSeat.find({ flight_id: flight._id });
        const availableSeats = seats.filter(s => s.status === 'available').length;

        res.status(200).json({
            success: true,
            data: {
                ...flight.toObject(),
                classes,
                totalSeats: seats.length,
                availableSeats
            }
        });
    } catch (error) {
        console.error('Error in getFlightById:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Get flight statistics
exports.getFlightStatistics = async (req, res) => {
    try {
        const stats = await Flight.aggregate([
            { $match: { service_provider_id: new mongoose.Types.ObjectId(req.params.providerId) } },
            {
                $group: {
                    _id: null,
                    totalFlights: { $sum: 1 },
                    scheduledFlights: { 
                        $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
                    },
                    completedFlights: { 
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    cancelledFlights: { 
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: stats[0] || {
                totalFlights: 0,
                scheduledFlights: 0,
                completedFlights: 0,
                cancelledFlights: 0
            }
        });
    } catch (error) {
        console.error('Error in getFlightStatistics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Create new flight
exports.createFlight = async (req, res) => {
    try {
        const flight = await Flight.create({
            ...req.body,
            service_provider_id: req.params.providerId
        });

        res.status(201).json({
            success: true,
            data: flight
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update flight
exports.updateFlight = async (req, res) => {
    try {
        const flight = await Flight.findOneAndUpdate(
            { _id: req.params.flightId, service_provider_id: req.params.providerId },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!flight) {
            return res.status(404).json({
                success: false,
                error: 'Flight not found'
            });
        }

        res.status(200).json({
            success: true,
            data: flight
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete flight
exports.deleteFlight = async (req, res) => {
    try {
        const flight = await Flight.findOneAndDelete({
            _id: req.params.flightId,
            service_provider_id: req.params.providerId
        });

        if (!flight) {
            return res.status(404).json({
                success: false,
                error: 'Flight not found'
            });
        }

        // Also delete related classes, schedules, and seats
        await FlightClass.deleteMany({ flight_id: flight._id });
        await FlightSchedule.deleteMany({ flight_id: flight._id });
        await FlightSeat.deleteMany({ flight_id: flight._id });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error('Error in deleteFlight:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Update flight status
exports.updateFlightStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['scheduled', 'delayed', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid status'
            });
        }

        const flight = await Flight.findOneAndUpdate(
            { _id: req.params.flightId, service_provider_id: req.params.providerId },
            { status },
            { new: true, runValidators: true }
        );

        if (!flight) {
            return res.status(404).json({
                success: false,
                error: 'Flight not found'
            });
        }

        res.status(200).json({
            success: true,
            data: flight
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Get flight schedules
exports.getFlightSchedules = async (req, res) => {
    try {
        const schedules = await FlightSchedule.find({ 
            flight_id: req.params.flightId 
        }).populate('flight_id', 'flight_number airline_name');

        res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules
        });
    } catch (error) {
        console.error('Error in getFlightSchedules:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Get flight classes
exports.getFlightClasses = async (req, res) => {
    try {
        const classes = await FlightClass.find({ 
            flight_id: req.params.flightId 
        }).populate('flight_id', 'flight_number airline_name');

        res.status(200).json({
            success: true,
            count: classes.length,
            data: classes
        });
    } catch (error) {
        console.error('Error in getFlightClasses:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Get flight seats
exports.getFlightSeats = async (req, res) => {
    try {
        const seats = await FlightSeat.find({ 
            flight_id: req.params.flightId 
        }).populate('class_id', 'class_type class_name');

        res.status(200).json({
            success: true,
            count: seats.length,
            data: seats
        });
    } catch (error) {
        console.error('Error in getFlightSeats:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};
