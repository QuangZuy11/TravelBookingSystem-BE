const mongoose = require('mongoose');
const HotelBooking = require('../../models/hotel-booking.model');
const Payment = require('../../models/hotel-payment.model');
const { getProviderRoomIds } = require('../../middlewares/provider-auth.middleware');

/**
 * Provider Hotel Booking Management Controller
 * Quản lý bookings cho Service Provider
 */

/**
 * Lấy thống kê tổng quan
 * @route GET /api/provider/hotel-bookings/statistics
 * @desc Hiển thị 4 cards: Doanh thu, Lượt đặt phòng, Lượt hủy, Tỷ lệ hủy
 * @access Private (Provider only)
 */
exports.getStatistics = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;  // Lấy user ID từ token
        const { start_date, end_date, hotel_id } = req.query;

        console.log('📊 Getting statistics for user:', userId);

        // Lấy danh sách room IDs của provider (truyền userId)
        let roomIds = await getProviderRoomIds(userId);

        if (roomIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    total_revenue: 0,
                    total_bookings: 0,
                    total_cancellations: 0,
                    cancellation_rate: 0
                }
            });
        }

        // Build query
        const matchQuery = {
            hotel_room_id: { $in: roomIds }
        };

        // Filter theo thời gian
        if (start_date || end_date) {
            matchQuery.created_at = {};
            if (start_date) {
                matchQuery.created_at.$gte = new Date(start_date);
            }
            if (end_date) {
                matchQuery.created_at.$lte = new Date(end_date);
            }
        }

        // Filter theo hotel_id cụ thể (nếu provider có nhiều khách sạn)
        if (hotel_id) {
            const Room = require('../../models/room.model');
            const hotelRooms = await Room.find({ hotelId: hotel_id }).select('_id');
            const hotelRoomIds = hotelRooms.map(r => r._id);
            matchQuery.hotel_room_id = { $in: hotelRoomIds };
        }

        console.log('📊 Statistics Query:', matchQuery);

        // Aggregate để tính toán thống kê
        const stats = await HotelBooking.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    // ✅ Chỉ đếm bookings CONFIRMED và COMPLETED (đã thanh toán)
                    // Không đếm 'reserved' vì đó chỉ là booking tạm chưa thanh toán
                    total_bookings: {
                        $sum: {
                            $cond: [
                                { $in: ['$booking_status', ['confirmed', 'completed']] },
                                1,
                                0
                            ]
                        }
                    },
                    // Tổng số bookings bị hủy
                    total_cancellations: {
                        $sum: {
                            $cond: [{ $eq: ['$booking_status', 'cancelled'] }, 1, 0]
                        }
                    },
                    // Tổng doanh thu (chỉ tính bookings đã thanh toán)
                    total_revenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$payment_status', 'paid'] },
                                        { $in: ['$booking_status', ['confirmed', 'completed']] }
                                    ]
                                },
                                { $toDouble: '$total_amount' },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const statistics = stats[0] || {
            total_revenue: 0,
            total_bookings: 0,
            total_cancellations: 0
        };

        // Tính tỷ lệ hủy (%)
        const totalAll = statistics.total_bookings + statistics.total_cancellations;
        const cancellation_rate = totalAll > 0
            ? Math.round((statistics.total_cancellations / totalAll) * 100)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                total_revenue: Math.round(statistics.total_revenue),
                total_bookings: statistics.total_bookings,
                total_cancellations: statistics.total_cancellations,
                cancellation_rate: cancellation_rate
            }
        });

    } catch (error) {
        console.error('❌ Get Statistics Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thống kê',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Thống kê doanh thu theo ngày
 * @route GET /api/provider/hotel-bookings/statistics/daily
 * @desc Lấy doanh thu theo từng ngày (để vẽ line chart)
 * @access Private (Provider only)
 */
exports.getDailyStatistics = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { start_date, end_date, year, month } = req.query;

        // Lấy danh sách room IDs của provider
        let roomIds = await getProviderRoomIds(userId);

        if (roomIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Build date range
        let startDate, endDate;
        if (year && month) {
            // Nếu có year & month → lấy tháng đó
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (start_date && end_date) {
            // Nếu có start_date & end_date → dùng custom range
            startDate = new Date(start_date);
            endDate = new Date(end_date);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Mặc định: 30 ngày gần nhất
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
        }

        console.log('📅 Daily stats range:', startDate, 'to', endDate);

        // Aggregate by day
        const dailyStats = await HotelBooking.aggregate([
            {
                $match: {
                    hotel_room_id: { $in: roomIds },
                    created_at: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$created_at' },
                        month: { $month: '$created_at' },
                        day: { $dayOfMonth: '$created_at' }
                    },
                    total_revenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$payment_status', 'paid'] },
                                        { $in: ['$booking_status', ['confirmed', 'completed']] }
                                    ]
                                },
                                { $toDouble: '$total_amount' },
                                0
                            ]
                        }
                    },
                    total_bookings: {
                        $sum: {
                            $cond: [
                                { $in: ['$booking_status', ['reserved', 'confirmed', 'completed']] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        // Format response
        const formattedData = dailyStats.map(stat => ({
            date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
            revenue: Math.round(stat.total_revenue),
            bookings: stat.total_bookings
        }));

        res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error('❌ Get Daily Statistics Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thống kê theo ngày',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Thống kê doanh thu theo tháng
 * @route GET /api/provider/hotel-bookings/statistics/monthly
 * @desc Lấy doanh thu theo từng tháng (để vẽ bar chart)
 * @access Private (Provider only)
 */
exports.getMonthlyStatistics = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { year, start_date, end_date } = req.query;

        // Lấy danh sách room IDs của provider
        let roomIds = await getProviderRoomIds(userId);

        if (roomIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Build date range
        let startDate, endDate;
        if (year) {
            // Nếu có year → lấy cả năm
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        } else if (start_date && end_date) {
            startDate = new Date(start_date);
            endDate = new Date(end_date);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Mặc định: năm hiện tại
            const currentYear = new Date().getFullYear();
            startDate = new Date(currentYear, 0, 1);
            endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        }

        console.log('📅 Monthly stats range:', startDate, 'to', endDate);

        // Aggregate by month
        const monthlyStats = await HotelBooking.aggregate([
            {
                $match: {
                    hotel_room_id: { $in: roomIds },
                    created_at: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$created_at' },
                        month: { $month: '$created_at' }
                    },
                    total_revenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$payment_status', 'paid'] },
                                        { $in: ['$booking_status', ['confirmed', 'completed']] }
                                    ]
                                },
                                { $toDouble: '$total_amount' },
                                0
                            ]
                        }
                    },
                    total_bookings: {
                        $sum: {
                            $cond: [
                                { $in: ['$booking_status', ['reserved', 'confirmed', 'completed']] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Format response
        const formattedData = monthlyStats.map(stat => ({
            month: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}`,
            year: stat._id.year,
            month_number: stat._id.month,
            revenue: Math.round(stat.total_revenue),
            bookings: stat.total_bookings
        }));

        res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error('❌ Get Monthly Statistics Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thống kê theo tháng',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Thống kê doanh thu theo năm
 * @route GET /api/provider/hotel-bookings/statistics/yearly
 * @desc Lấy doanh thu theo từng năm
 * @access Private (Provider only)
 */
exports.getYearlyStatistics = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const { start_year, end_year } = req.query;

        // Lấy danh sách room IDs của provider
        let roomIds = await getProviderRoomIds(userId);

        if (roomIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Build date range
        let startDate, endDate;
        if (start_year && end_year) {
            startDate = new Date(start_year, 0, 1);
            endDate = new Date(end_year, 11, 31, 23, 59, 59, 999);
        } else {
            // Mặc định: 5 năm gần nhất
            const currentYear = new Date().getFullYear();
            startDate = new Date(currentYear - 4, 0, 1);
            endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        }

        console.log('📅 Yearly stats range:', startDate, 'to', endDate);

        // Aggregate by year
        const yearlyStats = await HotelBooking.aggregate([
            {
                $match: {
                    hotel_room_id: { $in: roomIds },
                    created_at: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { year: { $year: '$created_at' } },
                    total_revenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$payment_status', 'paid'] },
                                        { $in: ['$booking_status', ['confirmed', 'completed']] }
                                    ]
                                },
                                { $toDouble: '$total_amount' },
                                0
                            ]
                        }
                    },
                    total_bookings: {
                        $sum: {
                            $cond: [
                                { $in: ['$booking_status', ['reserved', 'confirmed', 'completed']] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': 1 }
            }
        ]);

        // Format response
        const formattedData = yearlyStats.map(stat => ({
            year: stat._id.year,
            revenue: Math.round(stat.total_revenue),
            bookings: stat.total_bookings
        }));

        res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error('❌ Get Yearly Statistics Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thống kê theo năm',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy danh sách bookings (với filter và pagination)
 * @route GET /api/provider/hotel-bookings
 * @desc Hiển thị table danh sách bookings
 * @access Private (Provider only)
 */
exports.getBookings = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;  // Lấy user ID từ token
        const {
            page = 1,
            limit = 20,
            search = '',
            booking_date,
            payment_status,
            booking_status,
            start_date,
            end_date,
            sort_by = 'created_at',
            order = 'desc'
        } = req.query;

        console.log('📋 Getting bookings for user:', userId);

        // Lấy danh sách room IDs của provider (truyền userId)
        let roomIds = await getProviderRoomIds(userId);

        if (roomIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    bookings: [],
                    pagination: {
                        total: 0,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: 0
                    }
                }
            });
        }

        // Build query
        const query = {
            hotel_room_id: { $in: roomIds }
        };

        // Filter theo tên khách hàng (search)
        if (search) {
            const User = require('../../models/user.model');
            const users = await User.find({
                $or: [
                    { name: new RegExp(search, 'i') },  // Sửa: name thay vì username
                    { username: new RegExp(search, 'i') },
                    { fullName: new RegExp(search, 'i') },
                    { email: new RegExp(search, 'i') },
                    { phone: new RegExp(search, 'i') },
                    { phoneNumber: new RegExp(search, 'i') }
                ]
            }).select('_id');

            if (users.length > 0) {
                query.user_id = { $in: users.map(u => u._id) };
            } else {
                // Không tìm thấy user nào → trả về rỗng
                return res.status(200).json({
                    success: true,
                    data: {
                        bookings: [],
                        pagination: {
                            total: 0,
                            page: parseInt(page),
                            limit: parseInt(limit),
                            totalPages: 0
                        }
                    }
                });
            }
        }

        // Filter theo ngày đặt cụ thể
        if (booking_date) {
            const date = new Date(booking_date);
            query.created_at = {
                $gte: new Date(date.setHours(0, 0, 0, 0)),
                $lte: new Date(date.setHours(23, 59, 59, 999))
            };
        }

        // Filter theo khoảng thời gian
        if (start_date || end_date) {
            query.created_at = {};
            if (start_date) {
                query.created_at.$gte = new Date(start_date);
            }
            if (end_date) {
                query.created_at.$lte = new Date(end_date);
            }
        }

        // Filter theo payment_status
        if (payment_status) {
            query.payment_status = payment_status;
        }

        // Filter theo booking_status
        if (booking_status) {
            query.booking_status = booking_status;
        }

        console.log('📋 Bookings Query:', query);

        // Đếm tổng số bookings
        const total = await HotelBooking.countDocuments(query);

        // Lấy bookings với pagination
        const bookings = await HotelBooking.find(query)
            .populate('user_id', 'name username fullName email phone phoneNumber')  // Thêm name, fullName
            .populate({
                path: 'hotel_room_id',
                select: 'roomNumber type floor hotelId',
                populate: {
                    path: 'hotelId',
                    select: 'name address city'
                }
            })
            .sort({ [sort_by]: order === 'desc' ? -1 : 1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        // Format data để trả về
        const formattedBookings = bookings.map(booking => {
            const room = booking.hotel_room_id || {};
            const hotel = room.hotelId || {};
            const user = booking.user_id || {};

            return {
                _id: booking._id,
                booking_number: booking.booking_number,
                customer_name: user.name || user.username || user.fullName || 'N/A',  // Sửa: name thay vì username
                customer_email: user.email || 'N/A',
                customer_phone: user.phone || user.phoneNumber || 'N/A',
                room_number: room.roomNumber || 'N/A',
                room_type: room.type || 'N/A',
                hotel_name: hotel.name || 'N/A',
                booking_date: booking.created_at,
                check_in_date: booking.check_in_date,
                check_out_date: booking.check_out_date,
                nights: booking.calculateNights ? booking.calculateNights() : 0,
                total_amount: parseFloat(booking.total_amount),
                payment_status: booking.payment_status,
                booking_status: booking.booking_status,
                created_at: booking.created_at,
                updated_at: booking.updated_at
            };
        });

        const totalPages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                bookings: formattedBookings,
                pagination: {
                    total: total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: totalPages
                }
            }
        });

    } catch (error) {
        console.error('❌ Get Bookings Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy chi tiết 1 booking
 * @route GET /api/provider/hotel-bookings/:bookingId
 * @desc Hiển thị modal chi tiết booking
 * @access Private (Provider only)
 */
exports.getBookingDetail = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;  // Lấy user ID từ token
        const { bookingId } = req.params;

        console.log('🔍 Getting booking detail for user:', userId);

        // Kiểm tra bookingId hợp lệ
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID không hợp lệ'
            });
        }

        // Lấy danh sách room IDs của provider (truyền userId)
        const roomIds = await getProviderRoomIds(userId);

        if (roomIds.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có khách sạn nào'
            });
        }

        // Tìm booking
        const booking = await HotelBooking.findOne({
            _id: bookingId,
            hotel_room_id: { $in: roomIds } // Đảm bảo booking thuộc về provider
        })
            .populate('user_id', 'name username fullName email phone phoneNumber')  // Thêm name, fullName
            .populate({
                path: 'hotel_room_id',
                select: 'roomNumber type floor price amenities hotelId',
                populate: {
                    path: 'hotelId',
                    select: 'name address city country phone email'
                }
            })
            .lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking hoặc bạn không có quyền xem'
            });
        }

        // Lấy thông tin payment nếu có
        const payment = await Payment.findOne({ booking_id: bookingId })
            .select('method status paid_at payos_order_code checkout_url')
            .lean();

        // Format data
        const room = booking.hotel_room_id || {};
        const hotel = room.hotelId || {};
        const user = booking.user_id || {};

        const detailData = {
            _id: booking._id,
            booking_number: booking.booking_number,

            // Thông tin khách hàng
            customer: {
                name: user.name || user.username || user.fullName || 'N/A',  // Sửa: name thay vì username
                email: user.email || 'N/A',
                phone: user.phone || user.phoneNumber || 'N/A'
            },

            // Thông tin phòng & khách sạn
            room: {
                room_number: room.roomNumber || 'N/A',
                type: room.type || 'N/A',
                floor: room.floor || 'N/A',
                price_per_night: room.price || 0,
                amenities: room.amenities || []
            },

            hotel: {
                name: hotel.name || 'N/A',
                address: hotel.address || 'N/A',
                city: hotel.city || 'N/A',
                country: hotel.country || 'N/A',
                phone: hotel.phone || 'N/A',
                email: hotel.email || 'N/A'
            },

            // Thông tin booking
            booking_date: booking.created_at,
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            nights: booking.calculateNights ? booking.calculateNights() : 0,
            guest_count: booking.guest_count || 1,

            // Thông tin thanh toán
            total_amount: parseFloat(booking.total_amount),
            payment_status: booking.payment_status,
            booking_status: booking.booking_status,

            // Chi tiết payment
            payment_info: payment ? {
                method: payment.method,
                status: payment.status,
                paid_at: payment.paid_at,
                order_code: payment.payos_order_code,
                checkout_url: payment.checkout_url
            } : null,

            // Timestamps
            created_at: booking.created_at,
            updated_at: booking.updated_at
        };

        res.status(200).json({
            success: true,
            data: detailData
        });

    } catch (error) {
        console.error('❌ Get Booking Detail Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy chi tiết booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
