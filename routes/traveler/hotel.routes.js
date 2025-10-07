const express = require('express');
const router = express.Router();
const travelerHotel = require('../../controllers/traveler/hotel.controller');

// ====================== ROUTES CHO FRONTEND SEARCH ======================

// Route chính cho search và filter khách sạn (cho frontend)
// GET /hotels/search?location=Hà Nội&checkIn=15/12/2024&checkOut=17/12/2024&adults=2&children=1&rooms=1&minPrice=500000&maxPrice=2000000&amenities=Spa,Wifi&category=4_star,5_star&page=1&limit=10&sortBy=rating&sortOrder=desc
router.get('/search', travelerHotel.searchHotels);

// Route để lấy các filter options cho sidebar (amenities, categories, price range)
// GET /hotels/filter-options?location=Hà Nội
router.get('/filter-options', travelerHotel.getFilterOptions);

// Route để suggest locations khi user nhập vào ô search
// GET /hotels/suggest?q=Hà
router.get('/suggest', travelerHotel.suggestLocations);

// ====================== ROUTES CƠ BẢN ======================

// Route để lấy tất cả khách sạn (không phân trang) - cho admin hoặc testing
router.get('/all', travelerHotel.listHotels);

// Route để lấy danh sách khách sạn với phân trang cơ bản
// GET /hotels?page=1&limit=10&category=5_star&status=active&city=hanoi&minRating=4
router.get('/', travelerHotel.getHotelsWithPagination);

// Route để lấy thông tin chi tiết một khách sạn theo ID
// GET /hotels/507f1f77bcf86cd799439011
router.get('/:id', travelerHotel.getHotelById);

// ====================== ROUTES TÌM KIẾM NÂNG CAO ======================

// Route để tìm kiếm khách sạn theo từ khóa
// GET /hotels/keyword/luxury?page=1&limit=10
router.get('/keyword/:keyword', async (req, res) => {
    try {
        const { keyword } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const filter = {
            status: 'active',
            $or: [
                { name: new RegExp(keyword, 'i') },
                { description: new RegExp(keyword, 'i') },
                { 'address.city': new RegExp(keyword, 'i') },
                { 'address.country': new RegExp(keyword, 'i') },
                { amenities: new RegExp(keyword, 'i') }
            ]
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const Hotel = require('../../models/hotel.model');

        const totalHotels = await Hotel.countDocuments(filter);
        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .sort({ rating: -1, bookingsCount: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalPages = Math.ceil(totalHotels / parseInt(limit));

        res.status(200).json({
            success: true,
            message: `Tìm thấy ${totalHotels} khách sạn với từ khóa "${keyword}"`,
            data: hotels,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalHotels,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Lỗi khi tìm kiếm khách sạn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tìm kiếm khách sạn',
            error: error.message
        });
    }
});

// Route để lấy khách sạn theo thành phố
// GET /hotels/city/hanoi?page=1&limit=10&category=4_star&minRating=4
router.get('/city/:cityName', async (req, res) => {
    try {
        const { cityName } = req.params;
        const { page = 1, limit = 10, category, minRating, sortBy = 'rating' } = req.query;

        const filter = {
            'address.city': new RegExp(cityName, 'i'),
            status: 'active'
        };

        if (category) {
            const categories = Array.isArray(category) ? category : category.split(',');
            filter.category = { $in: categories };
        }
        if (minRating) filter.rating = { $gte: parseFloat(minRating) };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const Hotel = require('../../models/hotel.model');

        // Tạo sort object
        const sort = {};
        switch (sortBy) {
            case 'price':
                sort['priceRange.min'] = 1;
                break;
            case 'priceDesc':
                sort['priceRange.min'] = -1;
                break;
            case 'bookings':
                sort.bookingsCount = -1;
                break;
            case 'rating':
            default:
                sort.rating = -1;
                sort.bookingsCount = -1;
                break;
        }

        const totalHotels = await Hotel.countDocuments(filter);
        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const totalPages = Math.ceil(totalHotels / parseInt(limit));

        res.status(200).json({
            success: true,
            message: `Tìm thấy ${totalHotels} khách sạn tại ${cityName}`,
            data: hotels,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalHotels,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy khách sạn theo thành phố:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy khách sạn theo thành phố',
            error: error.message
        });
    }
});

// Route để lấy khách sạn theo danh mục (category/sao)
// GET /hotels/category/5_star?page=1&limit=10&city=hanoi&minPrice=1000000&maxPrice=5000000
router.get('/category/:categoryType', async (req, res) => {
    try {
        const { categoryType } = req.params;
        const { page = 1, limit = 10, city, minPrice, maxPrice } = req.query;

        // Kiểm tra category hợp lệ
        const validCategories = ['1_star', '2_star', '3_star', '4_star', '5_star'];
        if (!validCategories.includes(categoryType)) {
            return res.status(400).json({
                success: false,
                message: 'Danh mục khách sạn không hợp lệ. Phải là: ' + validCategories.join(', ')
            });
        }

        const filter = {
            category: categoryType,
            status: 'active'
        };

        if (city) filter['address.city'] = new RegExp(city, 'i');
        if (minPrice || maxPrice) {
            filter['priceRange.min'] = {};
            if (minPrice) filter['priceRange.min'].$gte = parseInt(minPrice);
            if (maxPrice) filter['priceRange.min'].$lte = parseInt(maxPrice);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const Hotel = require('../../models/hotel.model');

        const totalHotels = await Hotel.countDocuments(filter);
        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .sort({ rating: -1, bookingsCount: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalPages = Math.ceil(totalHotels / parseInt(limit));

        res.status(200).json({
            success: true,
            message: `Tìm thấy ${totalHotels} khách sạn ${categoryType.replace('_', ' ')}`,
            data: hotels,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalHotels,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy khách sạn theo danh mục:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy khách sạn theo danh mục',
            error: error.message
        });
    }
});

// ====================== ROUTES ĐẶC BIỆT ======================

// Route để lấy top khách sạn được đánh giá cao nhất
// GET /hotels/top/rated?limit=10&city=hanoi
router.get('/top/rated', async (req, res) => {
    try {
        const { limit = 10, city, category } = req.query;

        const filter = {
            status: 'active',
            rating: { $gte: 4 } // Chỉ lấy khách sạn có rating >= 4
        };

        if (city) filter['address.city'] = new RegExp(city, 'i');
        if (category) filter.category = category;

        const Hotel = require('../../models/hotel.model');

        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .sort({ rating: -1, bookingsCount: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            message: `Top ${hotels.length} khách sạn được đánh giá cao nhất`,
            data: hotels
        });

    } catch (error) {
        console.error('Lỗi khi lấy top khách sạn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy top khách sạn',
            error: error.message
        });
    }
});

// Route để lấy khách sạn phổ biến nhất (theo số lượng booking)
// GET /hotels/top/popular?limit=10&city=hanoi
router.get('/top/popular', async (req, res) => {
    try {
        const { limit = 10, city, category } = req.query;

        const filter = {
            status: 'active',
            bookingsCount: { $gt: 0 }
        };

        if (city) filter['address.city'] = new RegExp(city, 'i');
        if (category) filter.category = category;

        const Hotel = require('../../models/hotel.model');

        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .sort({ bookingsCount: -1, rating: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            message: `Top ${hotels.length} khách sạn phổ biến nhất`,
            data: hotels
        });

    } catch (error) {
        console.error('Lỗi khi lấy khách sạn phổ biến:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy khách sạn phổ biến',
            error: error.message
        });
    }
});

// Route để lấy khách sạn mới nhất
// GET /hotels/latest?limit=10
router.get('/latest', async (req, res) => {
    try {
        const { limit = 10, city } = req.query;

        const filter = { status: 'active' };
        if (city) filter['address.city'] = new RegExp(city, 'i');

        const Hotel = require('../../models/hotel.model');

        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            message: `${hotels.length} khách sạn mới nhất`,
            data: hotels
        });

    } catch (error) {
        console.error('Lỗi khi lấy khách sạn mới nhất:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy khách sạn mới nhất',
            error: error.message
        });
    }
});

// ====================== ROUTES THỐNG KÊ ======================

// Route để lấy thống kê tổng quan
// GET /hotels/stats
router.get('/stats/overview', async (req, res) => {
    try {
        const Hotel = require('../../models/hotel.model');

        const stats = await Hotel.aggregate([
            { $match: { status: 'active' } },
            {
                $group: {
                    _id: null,
                    totalHotels: { $sum: 1 },
                    totalRooms: { $sum: '$totalRooms' },
                    availableRooms: { $sum: '$availableRooms' },
                    averageRating: { $avg: '$rating' },
                    totalBookings: { $sum: '$bookingsCount' },
                    totalRevenue: { $sum: '$revenue' }
                }
            }
        ]);

        const categoryStats = await Hotel.aggregate([
            { $match: { status: 'active' } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    averagePrice: { $avg: '$priceRange.min' },
                    averageRating: { $avg: '$rating' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            message: 'Thống kê tổng quan khách sạn',
            data: {
                overview: stats[0] || {},
                byCategory: categoryStats
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy thống kê:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê',
            error: error.message
        });
    }
});

module.exports = router;