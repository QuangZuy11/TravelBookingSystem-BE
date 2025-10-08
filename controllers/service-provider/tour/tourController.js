const mongoose = require('mongoose');
const Tour = require('../../../models/Tour');

// Dashboard Statistics
exports.getProviderDashboardStats = async (req, res) => {
    try {
        const providerId = req.params.providerId;
        
        const stats = await Promise.all([
            // Tour Stats
            Tour.aggregate([
                { $match: { providerId: mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: null,
                        totalTours: { $sum: 1 },
                        activeTours: { 
                            $sum: { 
                                $cond: [{ $eq: ["$status", "active"] }, 1, 0] 
                            }
                        },
                        totalBookings: { $sum: "$bookedCount" },
                        totalRevenue: { $sum: { $multiply: ["$price", "$bookedCount"] } },
                        averageRating: { $avg: "$rating" }
                    }
                }
            ]),

            // Recent Tour Bookings
            Tour.aggregate([
                { $match: { providerId: mongoose.Types.ObjectId(providerId) } },
                { $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'tourId',
                    as: 'recentBookings'
                }},
                { $unwind: '$recentBookings' },
                { $sort: { 'recentBookings.createdAt': -1 } },
                { $limit: 5 }
            ]),

            // Popular Tours
            Tour.aggregate([
                { $match: { providerId: mongoose.Types.ObjectId(providerId) } },
                { $sort: { bookedCount: -1 } },
                { $limit: 5 }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: {
                statistics: stats[0][0] || {
                    totalTours: 0,
                    activeTours: 0,
                    totalBookings: 0,
                    totalRevenue: 0,
                    averageRating: 0
                },
                recentBookings: stats[1] || [],
                popularTours: stats[2] || []
            }
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

// Get a single tour by ID
exports.getTourById = async (req, res) => {
    try {
        const tour = await Tour.findOne({
            _id: req.params.tourId,
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
            data: tour
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get all tours for a provider
exports.getAllProviderTours = async (req, res) => {
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

// Update tour status
exports.updateTourStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid status (active/inactive)'
            });
        }

        const tour = await Tour.findOneAndUpdate(
            {
                _id: req.params.tourId,
                providerId: req.params.providerId
            },
            { status },
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

// Get tour reviews
exports.getTourReviews = async (req, res) => {
    try {
        const reviews = await Tour.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId(req.params.tourId),
                    providerId: req.params.providerId
                }
            },
            {
                $lookup: {
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'tourId',
                    as: 'reviews'
                }
            },
            {
                $unwind: {
                    path: '$reviews',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'reviews.userId',
                    foreignField: '_id',
                    as: 'reviews.user'
                }
            },
            {
                $unwind: {
                    path: '$reviews.user',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$_id',
                    reviews: {
                        $push: {
                            _id: '$reviews._id',
                            rating: '$reviews.rating',
                            comment: '$reviews.comment',
                            createdAt: '$reviews.createdAt',
                            user: {
                                _id: '$reviews.user._id',
                                name: '$reviews.user.name',
                                email: '$reviews.user.email'
                            }
                        }
                    },
                    avgRating: { $avg: '$reviews.rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: reviews[0] || { reviews: [], avgRating: 0, totalReviews: 0 }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};