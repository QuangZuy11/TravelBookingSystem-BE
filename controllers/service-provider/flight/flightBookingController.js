const mongoose = require('mongoose');
const FlightBooking = require('../../../models/flight-booking.model');
const BookingPassenger = require('../../../models/booking-passenger.model');
const FlightSeat = require('../../../models/flight-seat.model');

// Get all bookings for a flight
exports.getFlightBookings = async (req, res) => {
    try {
        const bookings = await FlightBooking.find({ 
            flightId: req.params.flightId 
        }).populate('userId', 'name email')
          .populate('seatId')
          .populate('passengers');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = await FlightBooking.findById(req.params.bookingId)
            .populate('userId', 'name email')
            .populate('flightId')
            .populate('scheduleId')
            .populate('seatId')
            .populate('passengers');

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get user bookings
exports.getUserBookings = async (req, res) => {
    try {
        const bookings = await FlightBooking.find({ 
            userId: req.params.userId 
        }).populate('flightId')
          .populate('scheduleId')
          .populate('seatId')
          .populate('passengers');

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new booking
exports.createBooking = async (req, res) => {
    try {
        const { seatId, passengers } = req.body;

        // Check if seat is available
        const seat = await FlightSeat.findById(seatId);
        if (!seat || !seat.isAvailable) {
            return res.status(400).json({
                success: false,
                error: 'Seat is not available'
            });
        }

        // Create booking
        const booking = await FlightBooking.create({
            ...req.body,
            userId: req.params.userId
        });

        // Update seat availability
        await FlightSeat.findByIdAndUpdate(seatId, { isAvailable: false });

        // Create passengers if provided
        if (passengers && passengers.length > 0) {
            const passengerDocs = await BookingPassenger.insertMany(
                passengers.map(p => ({ ...p, bookingId: booking._id }))
            );
            booking.passengers = passengerDocs.map(p => p._id);
            await booking.save();
        }

        res.status(201).json({
            success: true,
            data: booking
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update booking
exports.updateBooking = async (req, res) => {
    try {
        const booking = await FlightBooking.findByIdAndUpdate(
            req.params.bookingId,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await FlightBooking.findById(req.params.bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Update booking status
        booking.status = 'cancelled';
        await booking.save();

        // Make seat available again
        await FlightSeat.findByIdAndUpdate(booking.seatId, { isAvailable: true });

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Delete booking
exports.deleteBooking = async (req, res) => {
    try {
        const booking = await FlightBooking.findByIdAndDelete(req.params.bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Make seat available again
        await FlightSeat.findByIdAndUpdate(booking.seatId, { isAvailable: true });

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
