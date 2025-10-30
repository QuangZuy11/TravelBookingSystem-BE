const mongoose = require('mongoose');
const HotelBooking = require('../../models/hotel-booking.model');
const Room = require('../../models/room.model');
const Hotel = require('../../models/hotel.model');
const User = require('../../models/user.model');

/**
 * Tạo booking tạm thời (reserved) khi user click "Đặt phòng"
 * @route POST /api/traveler/bookings/reserve
 * @desc Tạo booking với status 'reserved', lock phòng trong 5 phút
 * @access Private (User đã đăng nhập)
 */
exports.createReservedBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { hotel_room_id, check_in_date, check_out_date } = req.body;

        console.log('=== Create Reserved Booking ===');
        console.log('Room ID:', hotel_room_id);
        console.log('User ID:', req.user?._id);
        console.log('Check-in:', check_in_date);
        console.log('Check-out:', check_out_date);

        // Kiểm tra xem user đã được authenticate chưa
        if (!req.user || !req.user._id) {
            await session.abortTransaction();
            return res.status(401).json({
                success: false,
                message: 'Người dùng chưa được xác thực. Vui lòng đăng nhập.'
            });
        }

        const userId = req.user._id;

        // Validate input
        if (!hotel_room_id || !check_in_date || !check_out_date) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc: hotel_room_id, check_in_date, check_out_date'
            });
        }

        // Kiểm tra phòng có tồn tại không
        const room = await Room.findById(hotel_room_id).populate('hotelId').session(session);
        if (!room) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phòng'
            });
        }

        // Kiểm tra phòng có available không
        if (room.status !== 'available') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Phòng không khả dụng. Trạng thái hiện tại: ${room.status}`
            });
        }

        // Kiểm tra ngày check-in, check-out hợp lệ
        const checkIn = new Date(check_in_date);
        const checkOut = new Date(check_out_date);
        const now = new Date();

        if (checkIn < now) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Ngày check-in phải từ hôm nay trở đi'
            });
        }

        if (checkOut <= checkIn) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Ngày check-out phải sau ngày check-in'
            });
        }

        // Tính số đêm và tổng tiền
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        const totalAmount = room.pricePerNight * nights;

        // Tạo booking với status 'reserved'
        const newBooking = new HotelBooking({
            hotel_room_id: hotel_room_id,
            user_id: userId,
            check_in_date: checkIn,
            check_out_date: checkOut,
            total_amount: totalAmount,
            booking_status: 'reserved',
            payment_status: 'pending'
        });

        await newBooking.save({ session });

        // Commit transaction
        await session.commitTransaction();

        // Populate thông tin để trả về
        await newBooking.populate([
            {
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: 'name address'
                }
            },
            {
                path: 'user_id',
                select: 'name email',
                populate: {
                    path: 'traveler',
                    select: 'phone'
                }
            }
        ]);

        const hotel = newBooking.hotel_room_id.hotelId;
        const hotelAddress = hotel.address
            ? `${hotel.address.street || ''}, ${hotel.address.city || ''}, ${hotel.address.state || ''}, ${hotel.address.country || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
            : 'Không có thông tin địa chỉ';

        res.status(201).json({
            success: true,
            data: {
                bookingId: newBooking._id,
                hotel: {
                    name: hotel.name,
                    address: hotelAddress
                },
                room: {
                    type: room.type,
                    roomNumber: room.roomNumber,
                    floor: room.floor,
                    pricePerNight: room.pricePerNight
                },
                booking: {
                    checkInDate: newBooking.check_in_date,
                    checkOutDate: newBooking.check_out_date,
                    nights: nights,
                    totalAmount: parseFloat(newBooking.total_amount),
                    bookingStatus: newBooking.booking_status,
                    reserveExpireTime: newBooking.reserve_expire_time
                }
            },
            message: 'Tạo booking thành công. Vui lòng thanh toán trong 5 phút.'
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Create Reserved Booking Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi tạo booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

/**
 * Hủy booking khi user đóng modal (chưa thanh toán)
 * @route POST /api/traveler/bookings/:bookingId/cancel
 * @desc Hủy booking reserved và trả phòng về available
 * @access Private (User đã đăng nhập)
 */
exports.cancelReservedBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { bookingId } = req.params;

        console.log('=== Cancel Reserved Booking ===');
        console.log('Booking ID:', bookingId);
        console.log('User ID:', req.user?._id);

        // Kiểm tra xem user đã được authenticate chưa
        if (!req.user || !req.user._id) {
            await session.abortTransaction();
            return res.status(401).json({
                success: false,
                message: 'Người dùng chưa được xác thực. Vui lòng đăng nhập.'
            });
        }

        const userId = req.user._id;

        // Tìm booking
        const booking = await HotelBooking.findById(bookingId)
            .populate('hotel_room_id')
            .session(session);

        if (!booking) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking'
            });
        }

        // Kiểm tra quyền (chỉ user tạo booking mới được hủy)
        if (booking.user_id.toString() !== userId.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền hủy booking này'
            });
        }

        // Chỉ cho phép hủy booking có status 'reserved'
        if (booking.booking_status !== 'reserved') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Không thể hủy booking với trạng thái: ${booking.booking_status}`
            });
        }

        // Cập nhật booking status
        booking.booking_status = 'cancelled';
        booking.cancelled_at = new Date();
        await booking.save({ session });

        // Trả phòng về trạng thái 'available'
        await Room.findByIdAndUpdate(
            booking.hotel_room_id._id,
            {
                status: 'available',
                $pull: {
                    bookings: { bookingId: booking._id }
                }
            },
            { session }
        );

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: 'Hủy booking thành công. Phòng đã được trả về trạng thái available.',
            data: {
                bookingId: booking._id,
                bookingStatus: booking.booking_status,
                cancelledAt: booking.cancelled_at
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Cancel Reserved Booking Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi hủy booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

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
