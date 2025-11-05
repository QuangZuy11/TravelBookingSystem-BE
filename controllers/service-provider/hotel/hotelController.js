const mongoose = require('mongoose');
const Hotel = require('../../../models/hotel.model');
const Room = require('../../../models/room.model');
const googleDriveService = require('../../../services/googleDrive.service');

// Get all hotels for a provider
exports.getProviderHotels = async (req, res) => {
    try {
        const hotels = await Hotel.find({ providerId: req.params.providerId });

        res.status(200).json({
            success: true,
            count: hotels.length,
            data: hotels
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get hotel by ID
exports.getHotelById = async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            _id: req.params.hotelId,
            providerId: req.params.providerId
        }).populate({
            path: 'reviews.userId',
            select: 'name email'
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        res.status(200).json({
            success: true,
            data: hotel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Dashboard Statistics for Hotels
exports.getHotelDashboardStats = async (req, res) => {
    try {
        const providerId = req.params.providerId;

        const stats = await Promise.all([
            // Hotel Stats
            Hotel.aggregate([
                { $match: { providerId: mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: null,
                        totalHotels: { $sum: 1 },
                        activeHotels: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "active"] }, 1, 0]
                            }
                        },
                        totalRooms: { $sum: 1 }, // Count of hotels, not rooms
                        totalRevenue: { $sum: "$revenue" },
                        averageRating: { $avg: "$rating" }
                    }
                }
            ]),

            // Room Occupancy
            Room.aggregate([
                {
                    $lookup: {
                        from: 'hotels',
                        localField: 'hotelId',
                        foreignField: '_id',
                        as: 'hotel'
                    }
                },
                { $unwind: '$hotel' },
                {
                    $match: {
                        'hotel.providerId': mongoose.Types.ObjectId(providerId)
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Recent Bookings
            Hotel.aggregate([
                { $match: { providerId: mongoose.Types.ObjectId(providerId) } },
                {
                    $lookup: {
                        from: 'bookings',
                        localField: '_id',
                        foreignField: 'hotelId',
                        as: 'recentBookings'
                    }
                },
                { $unwind: '$recentBookings' },
                { $sort: { 'recentBookings.createdAt': -1 } },
                { $limit: 5 }
            ])
        ]);

        // Process room status stats
        const roomStats = stats[1].reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                statistics: stats[0][0] || {
                    totalHotels: 0,
                    activeHotels: 0,
                    totalRooms: 0, // Will be calculated from rooms
                    totalRevenue: 0,
                    averageRating: 0
                },
                roomOccupancy: {
                    available: roomStats.available || 0,
                    occupied: roomStats.occupied || 0,
                    maintenance: roomStats.maintenance || 0,
                    reserved: roomStats.reserved || 0
                },
                recentBookings: stats[2] || []
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get hotel statistics
exports.getHotelStatistics = async (req, res) => {
    try {
        const stats = await Hotel.aggregate([
            { $match: { providerId: req.params.providerId } },
            {
                $group: {
                    _id: null,
                    totalHotels: { $sum: 1 },
                    totalBookings: { $sum: '$bookingsCount' },
                    averageRating: { $avg: '$rating' },
                    totalRevenue: { $sum: '$revenue' }
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

// Create new hotel
exports.createHotel = async (req, res) => {

    let createdHotel = null;

    try {
        // Check if provider already has a hotel
        const existingHotel = await Hotel.findOne({ providerId: req.params.providerId });
        if (existingHotel) {
            return res.status(400).json({
                success: false,
                error: 'Provider chỉ được tạo 1 hotel duy nhất',
                message: 'Bạn đã có hotel, không thể tạo thêm hotel mới'
            });
        }
        // Parse hotel data if sent as multipart/form-data
        let hotelData;
        if (req.body.hotelData) {
            // Data sent as JSON string in FormData
            hotelData = JSON.parse(req.body.hotelData);
        } else {
            // Data sent as regular JSON or form-data fields
            hotelData = req.body;

            // Parse JSON strings in hotelData for array/object fields
            const fieldsToParseAsJSON = ['reviews', 'amenities', 'images', 'address', 'policies', 'contactInfo', 'priceRange'];

            fieldsToParseAsJSON.forEach(field => {
                if (hotelData[field] && typeof hotelData[field] === 'string') {
                    try {
                        hotelData[field] = JSON.parse(hotelData[field]);
                    } catch (e) {
                    }
                }
            });
        }

        // 1. Create hotel WITHOUT images first
        createdHotel = await Hotel.create({
            ...hotelData,
            providerId: req.params.providerId,
            images: [] // Will be updated after upload
        });


        // 2. Upload images to Google Drive if provided
        if (req.files && req.files.length > 0) {

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `hotels/${createdHotel._id}`
            );

            const imageUrls = uploadedFiles.map(f => f.direct_url);

            // 3. Update hotel with image URLs
            createdHotel.images = imageUrls;
            await createdHotel.save();

        }

        res.status(201).json({
            success: true,
            message: req.files && req.files.length > 0
                ? `Hotel created with ${req.files.length} images`
                : 'Hotel created successfully',
            data: createdHotel
        });
    } catch (error) {
        console.error('❌ Error creating hotel:', error);

        // Rollback: delete hotel if it was created but upload failed
        if (createdHotel) {
            try {
                await Hotel.findByIdAndDelete(createdHotel._id);
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

// Update hotel
exports.updateHotel = async (req, res) => {

    try {
        // Initialize req.body if undefined/null
        if (!req.body) {
            req.body = {};
        }

        // Parse JSON strings in req.body for array/object fields
        const fieldsToParseAsJSON = ['reviews', 'amenities', 'images', 'address', 'policies', 'contactInfo', 'priceRange', 'existing_images'];

        fieldsToParseAsJSON.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                try {
                    req.body[field] = JSON.parse(req.body[field]);
                } catch (e) {
                }
            }
        });

        let finalImageUrls = [];

        // Get existing images from frontend (ONLY images user wants to keep)
        // Frontend sends existing_images = array of URLs to keep (can be reordered, some deleted)
        const existingImages = req.body.existing_images || [];

        if (req.files && req.files.length > 0) {
            req.files.forEach((file, i) => {
            });

            // Import Google Drive service
            const googleDriveService = require('../../../services/googleDrive.service');

            const uploadedFiles = await googleDriveService.uploadFiles(
                req.files,
                `hotels/${req.params.id}`
            );

            const newImageUrls = uploadedFiles.map(f => f.direct_url);

            // Combine: existing (kept by user) + new uploaded
            finalImageUrls = [...existingImages, ...newImageUrls];
        } else {
            // No new files - use existing_images as-is
            // This allows: delete images, reorder images
            finalImageUrls = existingImages;
        }

        req.body.images = finalImageUrls;

        delete req.body.existing_images;

        const hotel = await Hotel.findOneAndUpdate(
            { _id: req.params.id, providerId: req.params.providerId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        res.status(200).json({
            success: true,
            message: req.files && req.files.length > 0
                ? `Hotel updated with ${req.files.length} new images (${hotel.images.length} total)`
                : `Hotel updated successfully (${hotel.images.length} images)`,
            data: hotel
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete hotel
exports.deleteHotel = async (req, res) => {
    try {
        const hotel = await Hotel.findOneAndDelete({
            _id: req.params.id,
            providerId: req.params.providerId
        });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Hotel deleted successfully',
            data: {
                deletedHotelId: hotel._id,
                redirectUrl: '/provider/hotels' // Gợi ý redirect cho frontend
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get hotel room availability
exports.getRoomAvailability = async (req, res) => {
    try {
        const availability = await Hotel.aggregate([
            {
                $match: {
                    _id: req.params.hotelId,
                    providerId: req.params.providerId
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: '_id',
                    foreignField: 'hotelId',
                    as: 'rooms'
                }
            },
            {
                $project: {
                    totalRooms: 1,
                    availableRooms: {
                        $size: {
                            $filter: {
                                input: '$rooms',
                                as: 'room',
                                cond: { $eq: ['$$room.status', 'available'] }
                            }
                        }
                    },
                    rooms: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: availability[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Get hotel bookings
exports.getHotelBookings = async (req, res) => {
    try {
        const bookings = await Hotel.aggregate([
            {
                $match: {
                    _id: req.params.hotelId,
                    providerId: req.params.providerId
                }
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'hotelId',
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

// ===== PUBLIC ENDPOINTS =====

// Get hotel details with POIs (Public - for travelers)
exports.getHotelDetailsWithPOIs = async (req, res) => {
    try {
        const hotelId = req.params.hotelId;

        // Get hotel details
        const hotel = await Hotel.findById(hotelId)
            .populate('destination_id', 'name description country city image')
            .populate({
                path: 'reviews.userId',
                select: 'name email'
            });

        if (!hotel) {
            return res.status(404).json({
                success: false,
                error: 'Hotel not found'
            });
        }

        // Get POIs in the same destination (if hotel has destination_id)
        let nearbyPOIs = [];
        if (hotel.destination_id) {
            const POI = require('../../../models/point-of-interest.model');

            const pois = await POI.find({
                destinationId: hotel.destination_id._id
                // Remove status filter if not exist in schema
            })
                .select('name description type images location ratings openingHours entryFee')
                .limit(10) // Limit to 10 POIs
                .sort({ 'ratings.average': -1 }); // Sort by rating

            // Transform POI data to match frontend expectations
            nearbyPOIs = pois.map(poi => ({
                _id: poi._id,
                name: poi.name,
                description: poi.description,
                category: poi.type, // Map 'type' to 'category' for frontend
                images: poi.images || [],
                location: poi.location, // Already has coordinates structure
                rating: poi.ratings?.average || 0, // Map ratings.average to rating
                opening_hours: formatOpeningHours(poi.openingHours), // Convert to simple string
                entry_fee: poi.entryFee ? {
                    adult: poi.entryFee.adult,
                    child: poi.entryFee.child
                } : null
            }));
        }

        res.status(200).json({
            success: true,
            data: {
                hotel,
                nearbyPOIs,
                destination: hotel.destination_id || null
            }
        });
    } catch (error) {
        console.error('Error getting hotel details with POIs:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Helper function to format opening hours
function formatOpeningHours(openingHours) {
    if (!openingHours) return null;

    // Check if has today's hours (simplified - just return Monday as example)
    const monday = openingHours.monday;
    if (monday && monday.open && monday.close) {
        return `${monday.open} - ${monday.close}`;
    }

    return 'Check schedule';
}