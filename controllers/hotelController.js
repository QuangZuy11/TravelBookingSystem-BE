const Hotel = require('../models/Hotel');

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