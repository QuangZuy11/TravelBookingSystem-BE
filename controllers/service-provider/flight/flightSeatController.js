const mongoose = require('mongoose');
const FlightSeat = require('../../../models/flight-seat.model');
const FlightClass = require('../../../models/flight-class.model');

// Get all seats for a flight
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
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get available seats
exports.getAvailableSeats = async (req, res) => {
    try {
        const seats = await FlightSeat.find({ 
            flight_id: req.params.flightId,
            status: 'available'
        }).populate('class_id', 'class_type class_name');

        res.status(200).json({
            success: true,
            count: seats.length,
            data: seats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get seat by ID
exports.getSeatById = async (req, res) => {
    try {
        const seat = await FlightSeat.findById(req.params.seatId)
            .populate('class_id', 'class_type class_name')
            .populate('flight_id', 'flight_number airline_name');

        if (!seat) {
            return res.status(404).json({
                success: false,
                error: 'Seat not found'
            });
        }

        res.status(200).json({
            success: true,
            data: seat
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new seat
exports.createSeat = async (req, res) => {
    try {
        const seat = await FlightSeat.create({
            ...req.body,
            flight_id: req.params.flightId
        });

        res.status(201).json({
            success: true,
            data: seat
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Bulk create seats
exports.bulkCreateSeats = async (req, res) => {
    try {
        const { seats, replaceExisting = false } = req.body; // Array of seat objects
        
        if (!seats || !Array.isArray(seats) || seats.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an array of seats'
            });
        }

        const flightId = req.params.flightId;
        
        if (replaceExisting) {
            // Delete all existing seats for this flight
            await FlightSeat.deleteMany({ flight_id: flightId });
            
            // Create new seats
            const seatsToCreate = seats.map(seat => ({
                ...seat,
                flight_id: flightId
            }));

            const createdSeats = await FlightSeat.insertMany(seatsToCreate);

            return res.status(201).json({
                success: true,
                message: 'All seats replaced successfully',
                count: createdSeats.length,
                data: createdSeats
            });
        } else {
            // Get existing seat numbers for this flight
            const existingSeats = await FlightSeat.find(
                { flight_id: flightId },
                { seat_number: 1 }
            );
            const existingSeatNumbers = new Set(existingSeats.map(s => s.seat_number));
            
            // Filter out seats that already exist
            const newSeats = seats.filter(seat => !existingSeatNumbers.has(seat.seat_number));
            const skippedSeats = seats.filter(seat => existingSeatNumbers.has(seat.seat_number));
            
            if (newSeats.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'All seat numbers already exist',
                    skipped: skippedSeats.length,
                    skippedSeats: skippedSeats.map(s => s.seat_number)
                });
            }
            
            // Create only new seats
            const seatsToCreate = newSeats.map(seat => ({
                ...seat,
                flight_id: flightId
            }));

            const createdSeats = await FlightSeat.insertMany(seatsToCreate);

            res.status(201).json({
                success: true,
                message: `${createdSeats.length} seats created, ${skippedSeats.length} skipped (already exist)`,
                created: createdSeats.length,
                skipped: skippedSeats.length,
                skippedSeats: skippedSeats.length > 0 ? skippedSeats.map(s => s.seat_number) : undefined,
                data: createdSeats
            });
        }
    } catch (error) {
        console.error('Error in bulkCreateSeats:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Server Error'
        });
    }
};

// Update seat
exports.updateSeat = async (req, res) => {
    try {
        const seat = await FlightSeat.findByIdAndUpdate(
            req.params.seatId,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!seat) {
            return res.status(404).json({
                success: false,
                error: 'Seat not found'
            });
        }

        res.status(200).json({
            success: true,
            data: seat
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete seat
exports.deleteSeat = async (req, res) => {
    try {
        const seat = await FlightSeat.findByIdAndDelete(req.params.seatId);

        if (!seat) {
            return res.status(404).json({
                success: false,
                error: 'Seat not found'
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

// Update seat status
exports.updateSeatStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['available', 'booked', 'blocked'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid status'
            });
        }

        const seat = await FlightSeat.findByIdAndUpdate(
            req.params.seatId,
            { status },
            { new: true, runValidators: true }
        );

        if (!seat) {
            return res.status(404).json({
                success: false,
                error: 'Seat not found'
            });
        }

        res.status(200).json({
            success: true,
            data: seat
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};
