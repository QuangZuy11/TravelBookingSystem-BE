const mongoose = require('mongoose');
const HotelBooking = require('../../models/hotel-booking.model');
const Room = require('../../models/room.model');
const Hotel = require('../../models/hotel.model');
const User = require('../../models/user.model');

/**
 * Lấy thông tin thanh toán booking để hiển thị trước khi thanh toán
 * @route GET /api/traveler/bookings/:bookingId/payment-info
 * @desc Hiển thị thông tin chi tiết booking khi người dùng click vào button thanh toán
 * @access Private (User đã đăng nhập)
 */
exports.getBookingPaymentInfo = async (req, res) => {
    try {
        const { bookingId } = req.params;

        console.log('=== Get Booking Payment Info ===');
        console.log('Booking ID:', bookingId);
        console.log('User ID:', req.user?._id);

        // Kiểm tra xem user đã được authenticate chưa
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng chưa được xác thực. Vui lòng đăng nhập.'
            });
        }

        const userId = req.user._id;

        // Kiểm tra booking có tồn tại không
        const booking = await HotelBooking.findById(bookingId)
            .populate({
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: 'name address'
                }
            })
            .populate({
                path: 'user_id',
                select: 'name email',
                populate: {
                    path: 'traveler',
                    select: 'phone'
                }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking'
            });
        }

        // Kiểm tra quyền truy cập (chỉ user đã đặt mới được xem)
        if (booking.user_id._id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem thông tin booking này'
            });
        }

        // Tính số đêm
        const nights = booking.calculateNights();

        // Lấy thông tin phòng
        const room = booking.hotel_room_id;
        const hotel = room.hotelId;

        // Format địa chỉ khách sạn
        const hotelAddress = hotel.address
            ? `${hotel.address.street || ''}, ${hotel.address.city || ''}, ${hotel.address.state || ''}, ${hotel.address.country || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
            : 'Không có thông tin địa chỉ';

        // Lấy thông tin người đặt
        const userInfo = booking.user_id;
        const travelerInfo = userInfo.traveler;

        // Chuẩn bị dữ liệu trả về
        const paymentInfo = {
            // Thông tin khách sạn
            hotel: {
                name: hotel.name,
                address: hotelAddress
            },

            // Thông tin phòng
            room: {
                type: room.type,
                roomNumber: room.roomNumber,
                floor: room.floor,
                area: room.area,
                capacity: room.capacity,
                pricePerNight: room.pricePerNight
            },

            // Thông tin người đặt
            guest: {
                name: userInfo.name,
                email: userInfo.email,
                phone: travelerInfo?.phone || 'Chưa cập nhật'
            },

            // Thông tin đặt phòng
            booking: {
                bookingId: booking._id,
                checkInDate: booking.check_in_date,
                checkOutDate: booking.check_out_date,
                nights: nights,
                bookingDate: booking.booking_date,
                bookingStatus: booking.booking_status,
                paymentStatus: booking.payment_status
            },

            // Thông tin giá tiền
            pricing: {
                pricePerNight: room.pricePerNight,
                nights: nights,
                totalAmount: parseFloat(booking.total_amount),
                calculation: `${room.pricePerNight.toLocaleString('vi-VN')} VNĐ × ${nights} đêm = ${parseFloat(booking.total_amount).toLocaleString('vi-VN')} VNĐ`
            }
        };

        res.status(200).json({
            success: true,
            data: paymentInfo,
            message: 'Lấy thông tin thanh toán thành công'
        });

    } catch (error) {
        console.error('Get Booking Payment Info Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thông tin thanh toán',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy danh sách booking của user
 * @route GET /api/traveler/bookings
 * @desc Lấy tất cả booking của user đang đăng nhập
 * @access Private
 */
exports.getUserBookings = async (req, res) => {
    try {
        // Kiểm tra xem user đã được authenticate chưa
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng chưa được xác thực. Vui lòng đăng nhập.'
            });
        }

        const userId = req.user._id;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { user_id: userId };

        // Filter theo status nếu có
        if (status) {
            query.booking_status = status;
        }

        const skip = (page - 1) * limit;

        const bookings = await HotelBooking.find(query)
            .populate({
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: 'name address images'
                }
            })
            .sort({ booking_date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await HotelBooking.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: bookings.length,
                    totalRecords: total
                }
            },
            message: 'Lấy danh sách booking thành công'
        });

    } catch (error) {
        console.error('Get User Bookings Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy chi tiết một booking
 * @route GET /api/traveler/bookings/:bookingId
 * @desc Lấy thông tin chi tiết của một booking
 * @access Private
 */
exports.getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;

        // Kiểm tra xem user đã được authenticate chưa
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng chưa được xác thực. Vui lòng đăng nhập.'
            });
        }

        const userId = req.user._id;

        const booking = await HotelBooking.findById(bookingId)
            .populate({
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: 'name address images amenities category'
                }
            })
            .populate({
                path: 'user_id',
                select: 'name email',
                populate: {
                    path: 'traveler',
                    select: 'phone nationality'
                }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking'
            });
        }

        // Kiểm tra quyền truy cập
        if (booking.user_id._id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem booking này'
            });
        }

        res.status(200).json({
            success: true,
            data: booking,
            message: 'Lấy thông tin booking thành công'
        });

    } catch (error) {
        console.error('Get Booking By ID Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thông tin booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = exports;
