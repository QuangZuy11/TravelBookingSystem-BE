const mongoose = require('mongoose');
const Hotel = require('../../models/hotel.model');

// Hàm chính để search và filter khách sạn cho frontend
exports.searchHotels = async (req, res) => {
    try {
        const {
            // Search parameters
            location,           // Vị trí (thành phố, khách sạn...)
            checkIn,           // Ngày check-in (dd/mm/yyyy)
            checkOut,          // Ngày check-out (dd/mm/yyyy)
            adults = 2,        // Số người lớn
            children = 0,      // Số trẻ em
            rooms = 1,         // Số phòng cần đặt

            // Filter parameters
            minPrice,          // Giá tối thiểu
            maxPrice,          // Giá tối đa
            amenities,         // Tiện nghi (array hoặc string phân cách bằng dấu phẩy)
            category,          // Tiêu chuẩn sao

            // Pagination
            page = 1,
            limit = 10,

            // Sorting
            sortBy = 'rating',  // rating, price, bookingsCount
            sortOrder = 'desc'  // asc, desc
        } = req.query;

        // Tạo filter object
        const filter = {
            status: 'active'
        };

        // Filter theo vị trí (tìm trong name, city, country)
        if (location) {
            filter.$or = [
                { name: new RegExp(location, 'i') },
                { 'address.city': new RegExp(location, 'i') },
                { 'address.country': new RegExp(location, 'i') },
                { 'address.street': new RegExp(location, 'i') }
            ];
        }

        // Filter theo số phòng có sẵn
        if (rooms) {
            filter.availableRooms = { $gte: parseInt(rooms) };
        }

        // Filter theo giá
        if (minPrice || maxPrice) {
            filter['priceRange.min'] = {};
            if (minPrice) filter['priceRange.min'].$gte = parseInt(minPrice);
            if (maxPrice) filter['priceRange.min'].$lte = parseInt(maxPrice);
        }

        // Filter theo tiện nghi
        if (amenities) {
            const amenitiesArray = Array.isArray(amenities)
                ? amenities
                : amenities.split(',').map(item => item.trim());
            filter.amenities = { $in: amenitiesArray };
        }

        // Filter theo category (tiêu chuẩn sao)
        if (category) {
            const categoriesArray = Array.isArray(category)
                ? category
                : category.split(',').map(item => item.trim());
            filter.category = { $in: categoriesArray };
        }

        // Tính toán phân trang
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Tạo sort object
        const sort = {};
        switch (sortBy) {
            case 'price':
                sort['priceRange.min'] = sortOrder === 'asc' ? 1 : -1;
                break;
            case 'bookingsCount':
                sort.bookingsCount = sortOrder === 'asc' ? 1 : -1;
                break;
            case 'rating':
            default:
                sort.rating = sortOrder === 'asc' ? 1 : -1;
                sort.bookingsCount = -1; // Secondary sort
                break;
        }

        // Lấy tổng số khách sạn phù hợp
        const totalHotels = await Hotel.countDocuments(filter);

        // Lấy danh sách khách sạn
        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .select({
                name: 1,
                description: 1,
                'address.city': 1,
                'address.country': 1,
                category: 1,
                amenities: 1,
                images: 1,
                rating: 1,
                'priceRange.min': 1,
                'priceRange.max': 1,
                bookingsCount: 1,
                availableRooms: 1,
                totalRooms: 1,
                status: 1,
                createdAt: 1
            })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Format data cho frontend
        const formattedHotels = hotels.map(hotel => ({
            id: hotel._id,
            name: hotel.name,
            description: hotel.description,
            location: `${hotel.address.city}${hotel.address.country ? ', ' + hotel.address.country : ''}`,
            category: hotel.category,
            rating: hotel.rating,
            ratingStars: '★'.repeat(Math.floor(hotel.rating)) + (hotel.rating % 1 >= 0.5 ? '☆' : ''),
            bookingsCount: hotel.bookingsCount,
            price: {
                min: hotel.priceRange.min,
                max: hotel.priceRange.max,
                currency: 'VND',
                formatted: `${hotel.priceRange.min?.toLocaleString('vi-VN')} VND`
            },
            images: hotel.images,
            mainImage: hotel.images[0] || '',
            amenities: hotel.amenities,
            availableRooms: hotel.availableRooms,
            totalRooms: hotel.totalRooms,
            isAvailable: hotel.availableRooms >= parseInt(rooms),
            providerId: hotel.providerId
        }));

        // Tính toán thông tin phân trang
        const totalPages = Math.ceil(totalHotels / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        // Response
        res.status(200).json({
            success: true,
            message: `Tìm thấy ${totalHotels} khách sạn`,
            data: {
                hotels: formattedHotels,
                searchInfo: {
                    location: location || '',
                    checkIn: checkIn || '',
                    checkOut: checkOut || '',
                    guests: {
                        adults: parseInt(adults),
                        children: parseInt(children),
                        rooms: parseInt(rooms)
                    },
                    filters: {
                        priceRange: { min: minPrice, max: maxPrice },
                        amenities: amenities ? (Array.isArray(amenities) ? amenities : amenities.split(',')) : [],
                        category: category ? (Array.isArray(category) ? category : category.split(',')) : []
                    }
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalHotels,
                    hasNextPage,
                    hasPrevPage,
                    limit: parseInt(limit),
                    showing: `${skip + 1}-${Math.min(skip + parseInt(limit), totalHotels)} của ${totalHotels}`
                },
                sorting: {
                    sortBy,
                    sortOrder
                }
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
};

// Hàm lấy các filter options để hiển thị trên frontend
exports.getFilterOptions = async (req, res) => {
    try {
        const { location } = req.query;

        // Base filter
        const baseFilter = { status: 'active' };
        if (location) {
            baseFilter.$or = [
                { name: new RegExp(location, 'i') },
                { 'address.city': new RegExp(location, 'i') },
                { 'address.country': new RegExp(location, 'i') }
            ];
        }

        // Lấy các giá trị unique cho filter
        const [priceRange, amenitiesOptions, categoryOptions] = await Promise.all([
            // Lấy khoảng giá
            Hotel.aggregate([
                { $match: baseFilter },
                {
                    $group: {
                        _id: null,
                        minPrice: { $min: '$priceRange.min' },
                        maxPrice: { $max: '$priceRange.min' }
                    }
                }
            ]),

            // Lấy tất cả amenities unique
            Hotel.distinct('amenities', baseFilter),

            // Lấy tất cả categories
            Hotel.distinct('category', baseFilter)
        ]);

        res.status(200).json({
            success: true,
            data: {
                priceRange: priceRange[0] || { minPrice: 0, maxPrice: 10000000 },
                amenities: amenitiesOptions.sort(),
                categories: categoryOptions.sort(),
                categoryLabels: {
                    '1_star': '1 Sao',
                    '2_star': '2 Sao',
                    '3_star': '3 Sao',
                    '4_star': '4 Sao',
                    '5_star': '5 Sao'
                }
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy filter options',
            error: error.message
        });
    }
};

// Hàm suggest locations khi user nhập vào ô tìm kiếm
exports.suggestLocations = async (req, res) => {
    try {
        const { q } = req.query; // query string

        if (!q || q.length < 2) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const suggestions = await Hotel.aggregate([
            {
                $match: {
                    status: 'active',
                    $or: [
                        { name: new RegExp(q, 'i') },
                        { 'address.city': new RegExp(q, 'i') },
                        { 'address.country': new RegExp(q, 'i') }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    hotels: { $addToSet: '$name' },
                    cities: { $addToSet: '$address.city' },
                    countries: { $addToSet: '$address.country' }
                }
            },
            {
                $project: {
                    _id: 0,
                    suggestions: {
                        $concatArrays: ['$hotels', '$cities', '$countries']
                    }
                }
            }
        ]);

        const results = suggestions[0]?.suggestions || [];
        const filteredResults = results
            .filter(item => item && item.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 10); // Limit to 10 suggestions

        res.status(200).json({
            success: true,
            data: filteredResults.map(item => ({
                label: item,
                value: item,
                type: 'location'
            }))
        });

    } catch (error) {
        console.error('Lỗi khi suggest locations:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi suggest locations',
            error: error.message
        });
    }
};

// 
exports.listHotels = async (req, res) => {
    try {
        const hotels = await Hotel.find()
            .populate('providerId', 'name email phone')
            .populate('reviews.userId', 'name email')
            .sort({ createdAt: -1 });

        if (!hotels || hotels.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn nào',
                data: []
            });
        }

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách khách sạn thành công',
            count: hotels.length,
            data: hotels
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách khách sạn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách khách sạn',
            error: error.message
        });
    }
};

exports.getHotelsWithPagination = async (req, res) => {
    try {
        const { page = 1, limit = 10, category, status, city, minRating } = req.query;

        const filter = {};

        if (category) filter.category = category;
        if (status) filter.status = status;
        if (city) filter['address.city'] = new RegExp(city, 'i');
        if (minRating) filter.rating = { $gte: parseFloat(minRating) };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalHotels = await Hotel.countDocuments(filter);

        const hotels = await Hotel.find(filter)
            .populate('providerId', 'name email phone')
            .populate('reviews.userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalPages = Math.ceil(totalHotels / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách khách sạn thành công',
            data: hotels,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalHotels,
                hasNextPage,
                hasPrevPage,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách khách sạn với phân trang:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách khách sạn',
            error: error.message
        });
    }
};

exports.getHotelById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID khách sạn không hợp lệ'
            });
        }

        const hotel = await Hotel.findById(id)
            .populate('providerId', 'name email phone')
            .populate('reviews.userId', 'name email');

        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách sạn'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Lấy thông tin khách sạn thành công',
            data: hotel
        });

    } catch (error) {
        console.error('Lỗi khi lấy thông tin khách sạn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thông tin khách sạn',
            error: error.message
        });
    }
};