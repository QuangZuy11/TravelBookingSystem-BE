const mongoose = require('mongoose');
const Tour = require('../../../models/tour.model');
const Review = require('../../../models/review.model');
const Itinerary = require('../../../models/itinerary.model');

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
                {
                    $lookup: {
                        from: 'bookings',
                        localField: '_id',
                        foreignField: 'tourId',
                        as: 'recentBookings'
                    }
                },
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
            provider_id: req.params.providerId
        });
        res.status(201).json({
            success: true,
            data: tour
        });
    } catch (error) {
        console.error('❌ Tour creation error:', error);
        res.status(400).json({
            success: false,
            error: error.message,
            details: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : undefined
        });
    }
};

// Update tour
exports.updateTour = async (req, res) => {
    try {
        const tour = await Tour.findOneAndUpdate(
            { _id: req.params.tourId, provider_id: req.params.providerId },
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
            message: 'Tour updated successfully',
            data: tour
        });
    } catch (error) {
        console.error('❌ Update tour error:', error);
        res.status(400).json({
            success: false,
            error: error.message,
            details: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : undefined
        });
    }
};

// Get a single tour by ID
exports.getTourById = async (req, res) => {
    try {
        const tour = await Tour.findOne({
            _id: req.params.tourId,
            provider_id: req.params.providerId
        })
            .populate('provider_id', 'company_name email phone rating')
            .populate({
                path: 'itineraries',
                select: 'title description duration days activities'
            });
        // Note: Reviews populate removed - will be added in separate endpoint
        // .populate({
        //     path: 'reviews',
        //     select: 'rating comment traveler_id created_at',
        //     options: { limit: 5, sort: '-created_at' }
        // });

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
        console.error('❌ Get tour error:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

// Get all tours for a provider
exports.getAllProviderTours = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { status, category, difficulty, page = 1, limit = 10, sort = '-created_at' } = req.query;

        // Build query
        const query = { provider_id: providerId };

        if (status) query.status = status;
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const tours = await Tour.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('provider_id', 'company_name email phone')
            .select('-__v');

        const total = await Tour.countDocuments(query);

        res.status(200).json({
            success: true,
            count: tours.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: tours
        });
    } catch (error) {
        console.error('❌ Get tours error:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

// Delete tour
exports.deleteTour = async (req, res) => {
    try {
        const tour = await Tour.findOneAndDelete({
            _id: req.params.tourId,
            provider_id: req.params.providerId
        });

        if (!tour) {
            return res.status(404).json({
                success: false,
                error: 'Tour not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Tour deleted successfully',
            data: {}
        });
    } catch (error) {
        console.error('❌ Delete tour error:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

// Update tour status
exports.updateTourStatus = async (req, res) => {
    try {
        const { providerId, tourId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['draft', 'active', 'inactive', 'archived'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ',
                error: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Find tour
        const tour = await Tour.findById(tourId);

        if (!tour) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tour',
                error: 'Tour not found'
            });
        }

        // Check ownership
        if (tour.provider_id.toString() !== providerId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thay đổi trạng thái tour này',
                error: 'Unauthorized'
            });
        }

        // Business logic validation
        if (status === 'active') {
            // Check if tour has required fields for activation
            if (!tour.image) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể kích hoạt tour chưa có hình ảnh',
                    error: 'Tour must have at least one image to be activated'
                });
            }

            if (!tour.available_dates || tour.available_dates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể kích hoạt tour chưa có ngày khởi hành',
                    error: 'Tour must have at least one available date to be activated'
                });
            }

            if (!tour.pricing || !tour.pricing.adult) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể kích hoạt tour chưa có giá',
                    error: 'Tour must have pricing information to be activated'
                });
            }
        }

        // Store old status for logging
        const oldStatus = tour.status;

        // Update status
        tour.status = status;
        tour.updated_at = new Date();
        await tour.save();

        console.log(`✅ Tour status updated: ${tourId} from ${oldStatus} to ${status}`);

        // Return updated tour (select important fields only)
        res.status(200).json({
            success: true,
            message: 'Cập nhật trạng thái tour thành công',
            data: {
                _id: tour._id,
                title: tour.title,
                status: tour.status,
                location: tour.location,
                duration_hours: tour.duration_hours,
                pricing: tour.pricing,
                difficulty: tour.difficulty,
                rating: tour.rating,
                image: tour.image,
                updated_at: tour.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Error updating tour status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật trạng thái',
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