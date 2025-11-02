const mongoose = require('mongoose');
const Tour = require('../../../models/tour.model');
const Review = require('../../../models/review.model');
const Itinerary = require('../../../models/itinerary.model');
const googleDriveService = require('../../../services/googleDrive.service');

// Dashboard Statistics
exports.getProviderDashboardStats = async (req, res) => {
    try {
        const providerId = req.params.providerId;

        const stats = await Promise.all([
            // Tour Stats
            Tour.aggregate([
                { $match: { provider_id: new mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: null,
                        totalTours: { $sum: 1 },
                        activeTours: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "active"] }, 1, 0]
                            }
                        },
                        averageRating: { $avg: "$rating" }
                    }
                }
            ]),

            // Popular Tours (based on rating)
            Tour.aggregate([
                { $match: { provider_id: new mongoose.Types.ObjectId(providerId) } },
                { $sort: { rating: -1, total_rating: -1 } },
                { $limit: 5 }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: {
                statistics: stats[0][0] || {
                    totalTours: 0,
                    activeTours: 0,
                    averageRating: 0
                },
                popularTours: stats[1] || []
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
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
            { $match: { provider_id: new mongoose.Types.ObjectId(req.params.providerId) } },
            {
                $group: {
                    _id: null,
                    totalTours: { $sum: 1 },
                    averageRating: { $avg: '$rating' }
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
    let createdTour = null;

    try {
        // Parse tour data if sent as multipart/form-data
        let tourData;
        if (req.body.tourData) {
            tourData = JSON.parse(req.body.tourData);
        } else {
            tourData = req.body;

            // Parse JSON strings in tourData for array/object fields
            const fieldsToParseAsJSON = [
                'description', 'services', 'languages_offered', 'highlights',
                'what_to_bring', 'available_dates', 'capacity', 'booking_info',
                'pricing', 'meeting_point', 'accessibility', 'included_services'
            ];

            fieldsToParseAsJSON.forEach(field => {
                if (tourData[field] && typeof tourData[field] === 'string') {
                    try {
                        tourData[field] = JSON.parse(tourData[field]);
                    } catch (e) {
                        // Keep as string if JSON parse fails
                    }
                }
            });
        }

        // 1. Create tour with image handling
        // Priority: tourData.image (URL from frontend) > '' (will upload file later)
        const initialImage = tourData.image || (req.file ? '' : tourData.image);

        createdTour = await Tour.create({
            ...tourData,
            provider_id: req.params.providerId,
            image: initialImage || '' // Use existing URL or empty (will upload)
        });

        // 2. Upload image to Google Drive if file provided (overrides URL)
        if (req.file) {
            const uploadedFile = await googleDriveService.uploadFile(
                req.file,
                `tours/${createdTour._id}`
            );

            // 3. Update tour with uploaded image URL
            createdTour.image = uploadedFile.direct_url;
            await createdTour.save();

        } else if (!initialImage) {
            // No file and no URL provided - this is an error
            throw new Error('Tour image is required - provide either a file upload or image URL');
        }

        res.status(201).json({
            success: true,
            message: req.file ? 'Tour created with image' : 'Tour created successfully',
            data: createdTour
        });
    } catch (error) {
        console.error('❌ Tour creation error:', error);

        // Rollback: delete tour if it was created but upload failed
        if (createdTour) {
            try {
                await Tour.findByIdAndDelete(createdTour._id);
            } catch (rollbackError) {
                console.error('❌ Rollback failed:', rollbackError);
            }
        }

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
        // Initialize req.body if undefined/null
        if (!req.body) {
            req.body = {};
        }

        // Parse JSON strings in req.body for array/object fields
        const fieldsToParseAsJSON = [
            'description', 'services', 'languages_offered', 'highlights',
            'what_to_bring', 'available_dates', 'capacity', 'booking_info',
            'pricing', 'meeting_point', 'accessibility', 'included_services'
        ];

        fieldsToParseAsJSON.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                try {
                    req.body[field] = JSON.parse(req.body[field]);
                } catch (e) {
                    // Keep as string if JSON parse fails
                }
            }
        });

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
        console.error('❌ === ERROR IN UPDATE TOUR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
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
            // destination is stored as a string now; no populate
            .populate({
                path: 'itineraries',
                select: 'title description activities meals notes day_number'
                // No need to populate activities - they are simple array objects now
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

        // Clean up response data
        const tourObj = tour.toObject();

        // Clean up itineraries: remove null accommodation and transportation
        if (tourObj.itineraries && tourObj.itineraries.length > 0) {
            tourObj.itineraries = tourObj.itineraries.map(itinerary => {
                if (itinerary.accommodation === null) {
                    delete itinerary.accommodation;
                }
                if (itinerary.transportation === null) {
                    delete itinerary.transportation;
                }
                return itinerary;
            });
        }

        // Clean up pricing: only keep base_price
        if (tourObj.pricing) {
            const basePrice = tourObj.pricing.base_price;
            tourObj.pricing = { base_price: basePrice };
        }

        res.status(200).json({
            success: true,
            data: tourObj
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
            // destination is stored as a string now; no populate
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

            if (!tour.price || tour.price < 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể kích hoạt tour chưa có giá hợp lệ',
                    error: 'Tour must have a valid price (at least 1,000 VND) to be activated'
                });
            }

            if (!tour.title || !tour.description) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể kích hoạt tour chưa đầy đủ thông tin',
                    error: 'Tour must have title and description to be activated'
                });
            }
        }

        // Store old status for logging
        const oldStatus = tour.status;

        // Update status
        tour.status = status;
        tour.updated_at = new Date();
        await tour.save();

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