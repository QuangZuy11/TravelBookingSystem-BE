const mongoose = require('mongoose');
const Hotel = require('../../models/hotel.model');

/**
 * Tìm kiếm và lọc danh sách khách sạn
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.searchHotels = async (req, res) => {
    try {
        // Lấy các tham số từ query string
        const {
            // Tham số tìm kiếm
            location,           // Vị trí (thành phố, tỉnh, quốc gia)
            checkIn,           // Ngày check-in
            checkOut,          // Ngày check-out
            guests = 2,        // Số khách (mặc định 2)
            rooms = 1,         // Số phòng (mặc định 1)

            // Tham số lọc
            priceMin,          // Giá tối thiểu
            priceMax,          // Giá tối đa
            amenities,         // Tiện nghi
            category,          // Hạng sao
            rating,            // Đánh giá tối thiểu

            // Phân trang và sắp xếp
            page = 1,          // Trang hiện tại
            limit = 10,        // Số lượng kết quả mỗi trang
            sortBy = 'rating', // Sắp xếp theo (rating, price, popularity, newest)
            sortOrder = 'desc' // Thứ tự sắp xếp (asc, desc)
        } = req.query;

        // Khởi tạo query tìm kiếm cơ bản
        let searchQuery = { status: 'active' };

        // Tìm kiếm theo vị trí (thành phố, tỉnh, quốc gia, tên khách sạn)
        if (location) {
            const locationRegex = new RegExp(location, 'i'); // Tìm kiếm không phân biệt hoa thường
            searchQuery.$or = [
                { 'address.city': locationRegex },
                { 'address.state': locationRegex },
                { 'address.country': locationRegex },
                { name: locationRegex }
            ];
        }

        // Lọc theo khoảng giá
        if (priceMin || priceMax) {
            if (priceMin) {
                searchQuery['priceRange.min'] = { $gte: Number(priceMin) };
            }
            if (priceMax) {
                searchQuery['priceRange.max'] = { $lte: Number(priceMax) };
            }
        }

        // Lọc theo tiện nghi
        if (amenities) {
            const amenitiesList = Array.isArray(amenities)
                ? amenities
                : amenities.split(',').map(item => item.trim());
            searchQuery.amenities = { $in: amenitiesList };
        }

        // Lọc theo hạng sao
        if (category) {
            const categories = Array.isArray(category)
                ? category
                : category.split(',').map(item => item.trim());
            searchQuery.category = { $in: categories };
        }

        // Lọc theo đánh giá tối thiểu
        if (rating) {
            searchQuery.rating = { $gte: Number(rating) };
        }

        // Kiểm tra số phòng có sẵn
        if (rooms) {
            searchQuery.availableRooms = { $gte: Number(rooms) };
        }

        // TODO: Thêm logic kiểm tra availability theo ngày check-in/check-out
        // Hiện tại chỉ kiểm tra availableRooms > 0
        if (checkIn && checkOut) {
            // Sẽ cần integration với booking collection để kiểm tra phòng trống
            // Tạm thời bỏ qua logic này
        }

        // Thiết lập options sắp xếp
        let sortOptions = {};
        switch (sortBy) {
            case 'price':
                sortOptions = { 'priceRange.min': sortOrder === 'desc' ? -1 : 1 };
                break;
            case 'rating':
                sortOptions = { rating: sortOrder === 'desc' ? -1 : 1 };
                break;
            case 'popularity':
                sortOptions = { bookingsCount: -1 }; // Luôn sắp xếp theo booking count giảm dần
                break;
            case 'newest':
                sortOptions = { createdAt: -1 }; // Mới nhất trước
                break;
            default:
                sortOptions = { rating: -1 }; // Mặc định sắp xếp theo rating cao nhất
        }

        // Tính toán phân trang
        const skip = (Number(page) - 1) * Number(limit);

        // Thực hiện query tìm kiếm
        const hotels = await Hotel.find(searchQuery)
            .populate('providerId', 'name email phone') // Lấy thông tin nhà cung cấp
            .populate('reviews.userId', 'name email') // Lấy thông tin người review
            .sort(sortOptions)
            .skip(skip)
            .limit(Number(limit)); // Trả về tất cả các trường

        // Đếm tổng số kết quả cho phân trang
        const totalCount = await Hotel.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCount / Number(limit));

        // Tính toán thông tin phân trang
        const hasNextPage = Number(page) < totalPages;
        const hasPrevPage = Number(page) > 1;

        // Trả về kết quả thành công
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
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getHotelById = async (req, res) => {
    try {
        const { hotelId } = req.params;

        // Kiểm tra tính hợp lệ của ID
        if (!mongoose.Types.ObjectId.isValid(hotelId)) {
            return res.status(400).json({
                success: false,
                message: 'ID khách sạn không hợp lệ'
            });
        }

        // Tìm khách sạn theo ID
        const hotel = await Hotel.findById(hotelId)
            .populate('providerId', 'name email phone')
            .populate('reviews.userId', 'name email');

        // Kiểm tra khách sạn có tồn tại không
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn'
            });
        }

        res.status(200).json({
            success: true,
            data: hotel,
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
 * Lấy danh sách tiện nghi có sẵn
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAvailableAmenities = async (req, res) => {
    try {
        // Lấy tất cả tiện nghi duy nhất từ các khách sạn active
        const amenities = await Hotel.distinct('amenities', { status: 'active' });

        // Lọc bỏ các giá trị null, undefined hoặc rỗng
        const validAmenities = amenities.filter(amenity =>
            amenity && typeof amenity === 'string' && amenity.trim() !== ''
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
 * Lấy danh sách địa điểm có sẵn
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAvailableLocations = async (req, res) => {
    try {
        // Lấy danh sách thành phố, tỉnh, quốc gia duy nhất
        const cities = await Hotel.distinct('address.city', { status: 'active' });
        const states = await Hotel.distinct('address.state', { status: 'active' });
        const countries = await Hotel.distinct('address.country', { status: 'active' });

        // Tạo danh sách địa điểm với loại
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
 * Lấy khoảng giá cho slider
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPriceRange = async (req, res) => {
    try {
        // Sử dụng aggregation để tính toán min, max, avg price
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

        // Xử lý trường hợp không có data
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
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getFeaturedHotels = async (req, res) => {
    try {
        const { limit = 6 } = req.query;

        // Lấy khách sạn nổi bật dựa trên rating và số lượng booking
        const featuredHotels = await Hotel.find({ status: 'active' })
            .populate('providerId', 'name')
            .sort({ rating: -1, bookingsCount: -1 }) // Sắp xếp theo rating và popularity
            .limit(Number(limit))
            .select('-reviews -__v'); // Loại bỏ reviews để tối ưu performance

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