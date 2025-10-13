const mongoose = require('mongoose');
const FlightSchedule = require('../../../models/flight-schedule.model');
const Flight = require('../../../models/flight.model');

// Get all schedules for a flight
exports.getFlightSchedules = async (req, res) => {
    try {
        const schedules = await FlightSchedule.find({ 
            flightId: req.params.flightId 
        }).populate('flightId', 'flightNumber airline');

        res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get schedule by ID
exports.getScheduleById = async (req, res) => {
    try {
        const schedule = await FlightSchedule.findById(req.params.scheduleId)
            .populate('flightId');

        if (!schedule) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.status(200).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new schedule
exports.createSchedule = async (req, res) => {
    try {
        const schedule = await FlightSchedule.create({
            ...req.body,
            flightId: req.params.flightId
        });

        res.status(201).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update schedule
exports.updateSchedule = async (req, res) => {
    try {
        const schedule = await FlightSchedule.findByIdAndUpdate(
            req.params.scheduleId,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!schedule) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.status(200).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete schedule
exports.deleteSchedule = async (req, res) => {
    try {
        const schedule = await FlightSchedule.findByIdAndDelete(req.params.scheduleId);

        if (!schedule) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Update schedule status
exports.updateScheduleStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['scheduled', 'delayed', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid status'
            });
        }

        const schedule = await FlightSchedule.findByIdAndUpdate(
            req.params.scheduleId,
            { status },
            { new: true, runValidators: true }
        );

        if (!schedule) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found'
            });
        }

        res.status(200).json({
            success: true,
            data: schedule
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};
