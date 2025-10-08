const mongoose = require('mongoose');
const FlightClass = require('../../../models/FlightClass');
const Flight = require('../../../models/Flight');

// Get all classes for a flight
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
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get class by ID
exports.getClassById = async (req, res) => {
    try {
        const flightClass = await FlightClass.findById(req.params.classId)
            .populate('flight_id', 'flight_number airline_name');

        if (!flightClass) {
            return res.status(404).json({
                success: false,
                error: 'Flight class not found'
            });
        }

        res.status(200).json({
            success: true,
            data: flightClass
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new class for a flight
exports.createClass = async (req, res) => {
    try {
        const flightClass = await FlightClass.create({
            ...req.body,
            flight_id: req.params.flightId
        });

        res.status(201).json({
            success: true,
            data: flightClass
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update class
exports.updateClass = async (req, res) => {
    try {
        const flightClass = await FlightClass.findByIdAndUpdate(
            req.params.classId,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!flightClass) {
            return res.status(404).json({
                success: false,
                error: 'Flight class not found'
            });
        }

        res.status(200).json({
            success: true,
            data: flightClass
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete class
exports.deleteClass = async (req, res) => {
    try {
        const flightClass = await FlightClass.findByIdAndDelete(req.params.classId);

        if (!flightClass) {
            return res.status(404).json({
                success: false,
                error: 'Flight class not found'
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
