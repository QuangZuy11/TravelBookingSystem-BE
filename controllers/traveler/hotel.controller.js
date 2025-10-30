const mongoose = require('mongoose');
const Hotel = require('../../models/hotel.model');

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

        const searchQuery = { status: 'active' };

        if (location) {
            const locationRegex = new RegExp(location, 'i');
            searchQuery.$or = [
                { 'address.city': locationRegex },
                { 'address.state': locationRegex },
                { 'address.country': locationRegex },
                { name: locationRegex }
            ];
        }

        if (priceMin) {
            searchQuery['priceRange.min'] = { $gte: Number(priceMin) };
        }

        if (priceMax) {
            searchQuery['priceRange.max'] = { $lte: Number(priceMax) };
        }

        if (amenities) {
            const amenitiesList = Array.isArray(amenities)
                ? amenities
                : amenities.split(',').map(item => item.trim());
            searchQuery.amenities = { $in: amenitiesList };
        }

        if (category) {
            const categories = Array.isArray(category)
                ? category
                : category.split(',').map(item => item.trim());
            searchQuery.category = { $in: categories };
        }

        if (rating) {
            searchQuery.rating = { $gte: Number(rating) };
        }

        if (rooms) {
            searchQuery.availableRooms = { $gte: Number(rooms) };
        }

        if (checkIn && checkOut) {
            // TODO: cần tích hợp với booking để kiểm tra phòng trống theo ngày
        }

        let sortOptions = {};
        switch (sortBy) {
            case 'price':
                sortOptions = { 'priceRange.min': sortOrder === 'desc' ? -1 : 1 };
                break;
            case 'rating':
                sortOptions = { rating: sortOrder === 'desc' ? -1 : 1 };
                break;
            case 'popularity':
                sortOptions = { bookingsCount: -1 };
                break;
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            default:
                sortOptions = { rating: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);

        // Sử dụng withAvailableRooms để tự động tính availableRooms
        const hotelsRaw = await Hotel.find(searchQuery)
            .populate('providerId', 'name email phone') // Lấy thông tin nhà cung cấp
            .populate('reviews.userId', 'name email') // Lấy thông tin người review
            .sort(sortOptions)
            .skip(skip)
            .limit(Number(limit))
            .select('-reviews -__v');

        // Tính availableRooms cho từng hotel
        const Room = require('../../models/room.model');
        const hotels = await Promise.all(
            hotelsRaw.map(async (hotel) => {
                const hotelObj = hotel.toObject();
                hotelObj.availableRooms = await Room.countDocuments({
                    hotelId: hotel._id,
                    status: 'available'
                });
                return hotelObj;
            })
        );

        const totalCount = await Hotel.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCount / Number(limit));

        const hasNextPage = Number(page) < totalPages;
        const hasPrevPage = Number(page) > 1;

        res.status(200).json({
            success: true,
            data: {
                hotels,
                pagination: {
                    currentPage: Number(page),
                    totalPages,
                    totalCount,
                    hasNextPage,
                    hasPrevPage,
                    limit: Number(limit)
                },
                filters: {
                    location,
                    priceRange: { min: priceMin, max: priceMax },
                    amenities,
                    category,
                    rating,
                    sortBy,
                    sortOrder
                }
            },
            message: `Tìm thấy ${totalCount} khách sạn phù hợp`
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

        const hotel = await Hotel.findById(hotelId)
            .populate('providerId', 'name email phone')
            .populate('reviews.userId', 'name email');

        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn'
            });
        }

        // Tính availableRooms
        const Room = require('../../models/room.model');
        const hotelObj = hotel.toObject();
        hotelObj.availableRooms = await Room.countDocuments({
            hotelId: hotel._id,
            status: 'available'
        });

        res.status(200).json({
            success: true,
            data: hotelObj,
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
        const priceStats = await Hotel.aggregate([
            { $match: { status: 'active' } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$priceRange.min' },
                    maxPrice: { $max: '$priceRange.max' },
                    avgPrice: { $avg: '$priceRange.min' }
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

        // Tính availableRooms cho từng hotel
        const Room = require('../../models/room.model');
        const featuredHotels = await Promise.all(
            featuredHotelsRaw.map(async (hotel) => {
                const hotelObj = hotel.toObject();
                hotelObj.availableRooms = await Room.countDocuments({
                    hotelId: hotel._id,
                    status: 'available'
                });
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
