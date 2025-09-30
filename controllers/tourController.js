const Tour = require('../models/Tour');

// Get all tours for a provider
exports.getProviderTours = async (req, res) => {
    try {
        const tours = await Tour.find({ providerId: req.params.providerId });
        res.status(200).json({
            success: true,
            count: tours.length,
            data: tours
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get tour statistics
exports.getTourStatistics = async (req, res) => {
    try {
        const stats = await Tour.aggregate([
            { $match: { providerId: req.params.providerId } },
            {
                $group: {
                    _id: null,
                    totalTours: { $sum: 1 },
                    totalBookings: { $sum: '$bookedCount' },
                    averageRating: { $avg: '$rating' },
                    totalRevenue: { $sum: { $multiply: ['$price', '$bookedCount'] } }
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

// Create new tour
exports.createTour = async (req, res) => {
    try {
        const tour = await Tour.create({
            ...req.body,
            providerId: req.params.providerId
        });
        res.status(201).json({
            success: true,
            data: tour
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update tour
exports.updateTour = async (req, res) => {
    try {
        const tour = await Tour.findOneAndUpdate(
            { _id: req.params.id, providerId: req.params.providerId },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!tour) {
            return res.status(404).json({
                success: false,
                error: 'Tour not found'
            });
        }

        res.status(200).json({
            success: true,
            data: tour
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete tour
exports.deleteTour = async (req, res) => {
    try {
        const tour = await Tour.findOneAndDelete({
            _id: req.params.id,
            providerId: req.params.providerId
        });

        if (!tour) {
            return res.status(404).json({
                success: false,
                error: 'Tour not found'
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

// Get tour bookings
exports.getTourBookings = async (req, res) => {
    try {
        const bookings = await Tour.aggregate([
            {
                $match: {
                    _id: req.params.tourId,
                    providerId: req.params.providerId
                }
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'tourId',
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