const mongoose = require('mongoose');
const Hotel = require('../../../models/hotel.model');
const Room = require('../../../models/room.model');

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
                        totalRooms: { $sum: "$totalRooms" },
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
                    totalRooms: 0,
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
                    totalRooms: { $sum: '$totalRooms' },
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
    console.log(req.body);
    
    try {
        const hotel = await Hotel.create({
            ...req.body,
            providerId: req.params.providerId
        });
        res.status(201).json({
            success: true,
            data: hotel
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Update hotel
exports.updateHotel = async (req, res) => {
    try {
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
            data: {}
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