const mongoose = require('mongoose');
const Hotel = require('../../models/hotel.model');
const Room = require('../../models/room.model');

/**
 * Tìm kiếm và lọc danh sách khách sạn
 */
exports.searchHotels = async (req, res) => {
    try {
        const {
            location,
            checkIn,
            checkOut,
            guests = 2,
            rooms = 1,
            priceMin,
            priceMax,
            amenities,
            category,
            rating,
            page = 1,
            limit = 10,
            sortBy = 'rating',
            sortOrder = 'desc'
        } = req.query;

        // Base search query
        const searchQuery = { status: 'active' };

        // Location filter
        if (location) {
            const locationRegex = new RegExp(location, 'i');
            searchQuery.$or = [
                { 'address.city': locationRegex },
                { 'address.state': locationRegex },
                { 'address.country': locationRegex },
                { name: locationRegex }
            ];
        }

        // Amenities filter
        if (amenities) {
            const amenitiesList = Array.isArray(amenities)
                ? amenities
                : amenities.split(',').map(item => item.trim());
            searchQuery.amenities = { $in: amenitiesList };
        }

        // Category filter
        if (category) {
            const categories = Array.isArray(category)
                ? category
                : category.split(',').map(item => item.trim());
            searchQuery.category = { $in: categories };
        }

        // Rating filter
        if (rating) {
            searchQuery.rating = { $gte: Number(rating) };
        }

        // Sorting logic
        let sortOptions = {};
        switch (sortBy) {
            case 'rating':
                sortOptions = { rating: sortOrder === 'desc' ? -1 : 1 };
                break;
            case 'popularity':
                sortOptions = { bookingsCount: sortOrder === 'desc' ? -1 : 1 };
                break;
            case 'newest':
                sortOptions = { createdAt: sortOrder === 'desc' ? -1 : 1 };
                break;
            // price sorting will be handled after getting room prices
            default:
                sortOptions = { rating: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);

        // Get all hotels first
        const hotelsRaw = await Hotel.find(searchQuery)
            .populate('providerId', 'name email phone')
            .sort(sortOptions)
            .skip(skip)
            .limit(Number(limit))
            .select('-__v');

        // Process each hotel to get room information
        const hotels = await Promise.all(
            hotelsRaw.map(async (hotel) => {
                const hotelObj = hotel.toObject();

                // Get room information with price filter
                const roomQuery = {
                    hotelId: hotel._id,
                    status: 'available'
                };

                if (priceMin) {
                    roomQuery.pricePerNight = {
                        ...(roomQuery.pricePerNight || {}),
                        $gte: Number(priceMin)
                    };
                }
                if (priceMax) {
                    roomQuery.pricePerNight = {
                        ...(roomQuery.pricePerNight || {}),
                        $lte: Number(priceMax)
                    };
                }

                const availableRooms = await Room.find(roomQuery)
                    .select('pricePerNight type capacity')
                    .sort({ pricePerNight: 1 });

                hotelObj.availableRooms = availableRooms.length;

                // Add real price range based on available rooms
                if (availableRooms.length > 0) {
                    hotelObj.realPriceRange = {
                        min: availableRooms[0].pricePerNight,
                        max: availableRooms[availableRooms.length - 1].pricePerNight
                    };
                    hotelObj.cheapestRoom = {
                        price: availableRooms[0].pricePerNight,
                        type: availableRooms[0].type,
                        capacity: availableRooms[0].capacity
                    };
                } else {
                    hotelObj.realPriceRange = hotelObj.priceRange;
                }

                // Process promotion if exists
                if (hotelObj.latestPromotion) {
                    try {
                        const promotion = JSON.parse(hotelObj.latestPromotion);
                        hotelObj.latestPromotion = promotion;

                        if (promotion.discountType === 'percent') {
                            const discount = promotion.discountValue / 100;
                            hotelObj.discountedPriceRange = {
                                min: Math.round(hotelObj.realPriceRange.min * (1 - discount)),
                                max: Math.round(hotelObj.realPriceRange.max * (1 - discount))
                            };
                        } else if (promotion.discountType === 'fixed') {
                            hotelObj.discountedPriceRange = {
                                min: Math.max(0, hotelObj.realPriceRange.min - promotion.discountValue),
                                max: Math.max(0, hotelObj.realPriceRange.max - promotion.discountValue)
                            };
                        }
                    } catch (e) {
                        console.warn('Error parsing promotion:', e);
                        hotelObj.latestPromotion = null;
                    }
                }

                return hotelObj;
            })
        );

        // Sort by price if needed
        let processedHotels = hotels;
        if (sortBy === 'price') {
            processedHotels.sort((a, b) => {
                const priceA = a.cheapestRoom?.price || a.realPriceRange?.min || Infinity;
                const priceB = b.cheapestRoom?.price || b.realPriceRange?.min || Infinity;
                return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
            });
        }

        // Count total hotels for pagination
        const totalCount = await Hotel.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCount / Number(limit));

        res.status(200).json({
            success: true,
            data: {
                hotels: processedHotels,
                pagination: {
                    currentPage: Number(page),
                    totalPages,
                    totalCount: processedHotels.length,
                    hasNextPage: Number(page) < totalPages,
                    hasPrevPage: Number(page) > 1,
                    limit: Number(limit)
                },
                filters: {
                    priceRange: {
                        min: priceMin ? Number(priceMin) : null,
                        max: priceMax ? Number(priceMax) : null
                    },
                    sortBy,
                    sortOrder
                }
            },
            message: `Tìm thấy ${processedHotels.length} khách sạn phù hợp`
        });

    } catch (error) {
        console.error('Lỗi tìm kiếm khách sạn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy chi tiết khách sạn theo ID
 */
exports.getHotelById = async (req, res) => {
    try {
        const { hotelId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(hotelId)) {
            return res.status(400).json({
                success: false,
                message: 'ID khách sạn không hợp lệ'
            });
        }

        // Get hotel details with destination information
        const hotel = await Hotel.findById(hotelId)
            .populate('providerId', 'name email phone')
            .populate('destination_id', 'name description country city image')
            .select('-__v');

        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn'
            });
        }

        const hotelObj = hotel.toObject();

        // Get room information
        const rooms = await Room.find({
            hotelId: hotel._id,
            status: 'available'
        }).select('pricePerNight type capacity');

        hotelObj.availableRooms = rooms.length;

        if (rooms.length > 0) {
            rooms.sort((a, b) => a.pricePerNight - b.pricePerNight);
            hotelObj.realPriceRange = {
                min: rooms[0].pricePerNight,
                max: rooms[rooms.length - 1].pricePerNight
            };
            hotelObj.cheapestRoom = {
                price: rooms[0].pricePerNight,
                type: rooms[0].type,
                capacity: rooms[0].capacity
            };
        }

        // Process promotion
        if (hotelObj.latestPromotion) {
            try {
                const promotion = JSON.parse(hotelObj.latestPromotion);
                hotelObj.latestPromotion = promotion;

                if (promotion.discountType === 'percent') {
                    const discount = promotion.discountValue / 100;
                    hotelObj.discountedPriceRange = {
                        min: Math.round(hotelObj.realPriceRange.min * (1 - discount)),
                        max: Math.round(hotelObj.realPriceRange.max * (1 - discount))
                    };
                } else if (promotion.discountType === 'fixed') {
                    hotelObj.discountedPriceRange = {
                        min: Math.max(0, hotelObj.realPriceRange.min - promotion.discountValue),
                        max: Math.max(0, hotelObj.realPriceRange.max - promotion.discountValue)
                    };
                }
            } catch (e) {
                console.warn('Error parsing promotion:', e);
                hotelObj.latestPromotion = null;
            }
        }

        // Get POIs in the same destination (if hotel has destination_id) 
        let nearbyPOIs = [];
        if (hotelObj.destination_id) {
            const POI = require('../../models/point-of-interest.model');

            const pois = await POI.find({
                destinationId: hotelObj.destination_id._id
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
                hotel: hotelObj,
                nearbyPOIs,
                destination: hotelObj.destination_id || null
            },
            message: 'Lấy thông tin khách sạn thành công'
        });

    } catch (error) {
        console.error('Lỗi lấy chi tiết khách sạn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

/**
 * Lấy danh sách tiện nghi khả dụng
 */
exports.getAvailableAmenities = async (_req, res) => {
    try {
        const amenities = await Hotel.distinct('amenities', { status: 'active' });
        const validAmenities = amenities.filter(
            amenity => amenity && typeof amenity === 'string' && amenity.trim() !== ''
        );

        res.status(200).json({
            success: true,
            data: validAmenities,
            message: 'Lấy danh sách tiện nghi thành công'
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách tiện nghi:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy danh sách địa điểm khả dụng
 */
exports.getAvailableLocations = async (_req, res) => {
    try {
        const cities = await Hotel.distinct('address.city', { status: 'active' });
        const states = await Hotel.distinct('address.state', { status: 'active' });
        const countries = await Hotel.distinct('address.country', { status: 'active' });

        const locations = [
            ...cities.map(city => ({ type: 'city', name: city, displayName: city })),
            ...states.map(state => ({ type: 'state', name: state, displayName: state })),
            ...countries.map(country => ({ type: 'country', name: country, displayName: country }))
        ].filter(location => location.name && location.name.trim() !== '');

        res.status(200).json({
            success: true,
            data: locations,
            message: 'Lấy danh sách địa điểm thành công'
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách địa điểm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy khoảng giá tham khảo
 */
exports.getPriceRange = async (_req, res) => {
    try {
        // Get price range from actual room prices instead of hotel price ranges
        const priceStats = await Room.aggregate([
            { $match: { status: 'available' } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$pricePerNight' },
                    maxPrice: { $max: '$pricePerNight' },
                    avgPrice: { $avg: '$pricePerNight' }
                }
            }
        ]);

        const result = priceStats[0] || {
            minPrice: 0,
            maxPrice: 10000000,
            avgPrice: 1000000
        };

        res.status(200).json({
            success: true,
            data: {
                min: result.minPrice || 0,
                max: result.maxPrice || 10000000,
                average: Math.round(result.avgPrice || 1000000)
            },
            message: 'Lấy khoảng giá thành công'
        });
    } catch (error) {
        console.error('Lỗi lấy khoảng giá:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy danh sách khách sạn nổi bật
 */
exports.getFeaturedHotels = async (req, res) => {
    try {
        const { limit = 6 } = req.query;

        const featuredHotelsRaw = await Hotel.find({ status: 'active' })
            .populate('providerId', 'name')
            .sort({ rating: -1, bookingsCount: -1 })
            .limit(Number(limit))
            .select('-reviews -__v');

        // Process room information for each hotel
        const featuredHotels = await Promise.all(
            featuredHotelsRaw.map(async (hotel) => {
                const hotelObj = hotel.toObject();

                const rooms = await Room.find({
                    hotelId: hotel._id,
                    status: 'available'
                }).select('pricePerNight type capacity')
                    .sort({ pricePerNight: 1 });

                hotelObj.availableRooms = rooms.length;

                if (rooms.length > 0) {
                    hotelObj.realPriceRange = {
                        min: rooms[0].pricePerNight,
                        max: rooms[rooms.length - 1].pricePerNight
                    };
                    hotelObj.cheapestRoom = {
                        price: rooms[0].pricePerNight,
                        type: rooms[0].type,
                        capacity: rooms[0].capacity
                    };
                }

                // Process promotion if exists
                if (hotelObj.latestPromotion) {
                    try {
                        const promotion = JSON.parse(hotelObj.latestPromotion);
                        hotelObj.latestPromotion = promotion;

                        if (promotion.discountType === 'percent') {
                            const discount = promotion.discountValue / 100;
                            hotelObj.discountedPriceRange = {
                                min: Math.round(hotelObj.realPriceRange.min * (1 - discount)),
                                max: Math.round(hotelObj.realPriceRange.max * (1 - discount))
                            };
                        } else if (promotion.discountType === 'fixed') {
                            hotelObj.discountedPriceRange = {
                                min: Math.max(0, hotelObj.realPriceRange.min - promotion.discountValue),
                                max: Math.max(0, hotelObj.realPriceRange.max - promotion.discountValue)
                            };
                        }
                    } catch (e) {
                        console.warn('Error parsing promotion:', e);
                        hotelObj.latestPromotion = null;
                    }
                }

                return hotelObj;
            })
        );

        res.status(200).json({
            success: true,
            data: featuredHotels,
            message: 'Lấy danh sách khách sạn nổi bật thành công'
        });
    } catch (error) {
        console.error('Lỗi lấy khách sạn nổi bật:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ nội bộ',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    searchHotels: exports.searchHotels,
    getHotelById: exports.getHotelById,
    getAvailableAmenities: exports.getAvailableAmenities,
    getAvailableLocations: exports.getAvailableLocations,
    getPriceRange: exports.getPriceRange,
    getFeaturedHotels: exports.getFeaturedHotels
};