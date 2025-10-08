const mongoose = require('mongoose');
const BookingPassenger = require('../../../models/BookingPassenger');

// Get all passengers for a booking
exports.getBookingPassengers = async (req, res) => {
    try {
        const passengers = await BookingPassenger.find({ 
            bookingId: req.params.bookingId 
        }).populate('class', 'name');

        res.status(200).json({
            success: true,
            count: passengers.length,
            data: passengers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get passenger by ID
exports.getPassengerById = async (req, res) => {
    try {
        const passenger = await BookingPassenger.findById(req.params.passengerId)
            .populate('bookingId')
            .populate('class', 'name');

        if (!passenger) {
            return res.status(404).json({
                success: false,
                error: 'Passenger not found'
            });
        }

        res.status(200).json({
            success: true,
            data: passenger
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new passenger
exports.createPassenger = async (req, res) => {
    try {
        const passenger = await BookingPassenger.create({
            ...req.body,
            bookingId: req.params.bookingId
        });

        res.status(201).json({
            success: true,
            data: passenger
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update passenger
exports.updatePassenger = async (req, res) => {
    try {
        const passenger = await BookingPassenger.findByIdAndUpdate(
            req.params.passengerId,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!passenger) {
            return res.status(404).json({
                success: false,
                error: 'Passenger not found'
            });
        }

        res.status(200).json({
            success: true,
            data: passenger
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete passenger
exports.deletePassenger = async (req, res) => {
    try {
        const passenger = await BookingPassenger.findByIdAndDelete(req.params.passengerId);

        if (!passenger) {
            return res.status(404).json({
                success: false,
                error: 'Passenger not found'
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
