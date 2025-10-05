const Flight = require('../models/Flight');

// Get all flights for a provider
exports.getProviderFlights = async (req, res) => {
    try {
        const flights = await Flight.find({ providerId: req.params.providerId });
        res.status(200).json({
            success: true,
            count: flights.length,
            data: flights
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get flight statistics
exports.getFlightStatistics = async (req, res) => {
    try {
        const stats = await Flight.aggregate([
            { $match: { providerId: req.params.providerId } },
            {
                $group: {
                    _id: null,
                    totalFlights: { $sum: 1 },
                    totalSeats: { $sum: '$totalSeats' },
                    totalBookings: { $sum: '$bookedSeats' },
                    averageOccupancy: {
                        $avg: {
                            $divide: ['$bookedSeats', '$totalSeats']
                        }
                    },
                    totalRevenue: { $sum: { $multiply: ['$price', '$bookedSeats'] } }
                }
            }
        ]);
        res.status(200).json({
            success: true,
            data: stats[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Create new flight
exports.createFlight = async (req, res) => {
    try {
        const flight = await Flight.create({
            ...req.body,
            providerId: req.params.providerId
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
            { _id: req.params.id, providerId: req.params.providerId },
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
            _id: req.params.id,
            providerId: req.params.providerId
        });

        if (!flight) {
            return res.status(404).json({
                success: false,
                error: 'Flight not found'
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

// Get flight bookings
exports.getFlightBookings = async (req, res) => {
    try {
        const bookings = await Flight.aggregate([
            {
                $match: {
                    _id: req.params.flightId,
                    providerId: req.params.providerId
                }
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'flightId',
                    as: 'bookings'
                }
            }
        ]);

        res.status(200).json({
            success: true,
            count: bookings[0]?.bookings.length || 0,
            data: bookings[0]?.bookings || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get flight schedule
exports.getFlightSchedule = async (req, res) => {
    try {
        const schedule = await Flight.find({
            providerId: req.params.providerId,
            departureTime: {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            }
        }).sort({ departureTime: 1 });

        res.status(200).json({
            success: true,
            count: schedule.length,
            data: schedule
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};