const mongoose = require('mongoose');
const HotelBooking = require('../../models/hotel-booking.model');
const Room = require('../../models/room.model');
const Hotel = require('../../models/hotel.model');
const User = require('../../models/user.model');
const { createBookingCancellationNotification } = require('../../services/notification.service');

/**
 * Tạo booking tạm thời (reserved) khi user click "Đặt phòng"
 * @route POST /api/traveler/bookings/reserve
 * @desc Tạo booking với status 'reserved', lock phòng trong 2 phút
 * @access Private (User đã đăng nhập)
 */
exports.createReservedBooking = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { hotel_room_id, check_in_date, check_out_date } = req.body;


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

        // Kiểm tra phòng có đang maintenance không
        if (room.status === 'maintenance') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Phòng đang trong trạng thái bảo trì'
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

        // Kiểm tra phòng có available trong khoảng thời gian này không
        const { isAvailable, conflictBookings } = await HotelBooking.checkRoomAvailability(
            hotel_room_id,
            checkIn,
            checkOut
        );

        if (!isAvailable) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Phòng đã được đặt trong khoảng thời gian này',
                conflictDates: conflictBookings.map(b => ({
                    checkIn: b.check_in_date,
                    checkOut: b.check_out_date,
                    status: b.booking_status
                }))
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

        console.log('📊 Populated booking data:');
        console.log('- Room ID:', newBooking.hotel_room_id?._id);
        console.log('- Hotel ID:', newBooking.hotel_room_id?.hotelId?._id);
        console.log('- Hotel populated:', !!newBooking.hotel_room_id?.hotelId);

        const populatedRoom = newBooking.hotel_room_id;
        const hotel = populatedRoom?.hotelId;

        // Validate populated data
        if (!populatedRoom) {
            console.error('❌ Room not populated');
            return res.status(500).json({
                success: false,
                message: 'Lỗi: Không thể lấy thông tin phòng'
            });
        }

        if (!hotel) {
            console.error('❌ Hotel not populated for room:', populatedRoom._id);
            console.warn('⚠️ Continuing without hotel info - Room may not have hotelId reference');

            // Return booking without hotel info
            return res.status(201).json({
                success: true,
                data: {
                    bookingId: newBooking._id,
                    room: {
                        type: populatedRoom.type,
                        roomNumber: populatedRoom.roomNumber,
                        floor: populatedRoom.floor,
                        pricePerNight: populatedRoom.pricePerNight
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
                message: 'Tạo booking thành công. Vui lòng thanh toán trong 2 phút.',
                warning: 'Thông tin khách sạn không khả dụng'
            });
        }

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
                    type: populatedRoom.type,
                    roomNumber: populatedRoom.roomNumber,
                    floor: populatedRoom.floor,
                    pricePerNight: populatedRoom.pricePerNight
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
            message: 'Tạo booking thành công. Vui lòng thanh toán trong 2 phút.'
        });

    } catch (error) {
        // Only abort if transaction is still active
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
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

        // Tìm booking
        const booking = await HotelBooking.findById(bookingId)
            .populate('hotel_room_id')
            .populate({
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: 'name'
                }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking'
            });
        }

        // Kiểm tra quyền (chỉ user tạo booking mới được hủy)
        if (booking.user_id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền hủy booking này'
            });
        }

        // Chỉ cho phép hủy booking có status 'reserved' hoặc 'confirmed'
        if (!['reserved', 'confirmed'].includes(booking.booking_status)) {
            return res.status(400).json({
                success: false,
                message: `Không thể hủy booking với trạng thái: ${booking.booking_status}`
            });
        }

        // Cập nhật booking status (GIỮ NGUYÊN payment_status - KHÔNG hoàn tiền)
        booking.booking_status = 'cancelled';
        booking.cancelled_at = new Date();

        // KHÔNG update payment_status - giữ nguyên để tracking đã thanh toán hay chưa
        // - Nếu payment_status = 'paid' → Giữ 'paid' (không hoàn tiền)
        // - Nếu payment_status = 'pending' → Giữ 'pending' (chưa thanh toán)

        await booking.save({ validateBeforeSave: false }); // Skip validation

        // Xóa booking khỏi room's bookings array
        if (booking.hotel_room_id && booking.hotel_room_id._id) {
            await Room.findByIdAndUpdate(
                booking.hotel_room_id._id,
                {
                    $pull: {
                        bookings: { bookingId: booking._id }
                    }
                }
            );
        }

        // Create notification for booking cancellation
        try {
            const hotelName = booking.hotel_room_id?.hotelId?.name || 'N/A';
            const bookingNumber = `HB-${booking._id.toString().slice(-6).toUpperCase()}`;
            
            await createBookingCancellationNotification({
                userId: booking.user_id,
                type: 'hotel',
                bookingId: booking._id,
                bookingNumber: bookingNumber,
                hotelName: hotelName,
                reason: booking.payment_status === 'paid' 
                    ? 'Theo chính sách, tiền đã thanh toán sẽ không được hoàn lại'
                    : null
            });
            console.log('✅ Notification created for booking cancellation');
        } catch (notificationError) {
            console.error('❌ Error creating cancellation notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: booking.payment_status === 'paid'
                ? 'Hủy booking thành công. Lưu ý: Theo chính sách, tiền đã thanh toán sẽ không được hoàn lại.'
                : 'Hủy booking thành công.',
            data: {
                bookingId: booking._id,
                bookingStatus: booking.booking_status,
                paymentStatus: booking.payment_status,
                cancelledAt: booking.cancelled_at,
                note: booking.payment_status === 'paid'
                    ? 'Booking đã được thanh toán và không được hoàn tiền'
                    : 'Booking chưa thanh toán'
            }
        });

    } catch (error) {
        console.error('Cancel Reserved Booking Error:', error);
        console.error('Error Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi hủy booking',
            error: error.message
        });
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
            // Support multiple status values (comma-separated) or single value
            if (status.includes(',')) {
                query.booking_status = { $in: status.split(',').map(s => s.trim()) };
            } else {
                query.booking_status = status;
            }
        }

        const skip = (page - 1) * limit;

        const bookings = await HotelBooking.find(query)
            .populate({
                path: 'hotel_room_id',
                select: 'roomNumber type pricePerNight hotelId images', // Add images to room selection
                populate: {
                    path: 'hotelId',
                    select: 'name address images'
                }
            })
            .populate({
                path: 'user_id',
                select: 'name email phone'
            })
            .sort({ booking_date: -1, created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(); // Use lean() for better performance

        const total = await HotelBooking.countDocuments(query);

        // Convert Decimal128 to number for lean() results
        const processedBookings = bookings.map(booking => {
            if (booking.total_amount) {
                // Handle Decimal128 conversion
                if (typeof booking.total_amount === 'object' && booking.total_amount.$numberDecimal) {
                    booking.total_amount = parseFloat(booking.total_amount.$numberDecimal);
                } else if (typeof booking.total_amount === 'object') {
                    booking.total_amount = parseFloat(booking.total_amount.toString());
                }
            }
            return booking;
        });

        res.status(200).json({
            success: true,
            data: {
                bookings: processedBookings,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: processedBookings.length,
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

/**
 * Complete booking (chuyển từ confirmed -> completed, reset room availability, allow review)
 * @route POST /api/traveler/bookings/:bookingId/complete
 * @access Private
 */
exports.completeBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user._id;

        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng chưa được xác thực. Vui lòng đăng nhập.'
            });
        }

        const booking = await HotelBooking.findById(bookingId)
            .populate({
                path: 'hotel_room_id',
                populate: {
                    path: 'hotelId',
                    select: '_id name'
                }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy booking'
            });
        }

        // Kiểm tra quyền
        if (booking.user_id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thực hiện hành động này'
            });
        }

        // Kiểm tra trạng thái hợp lệ để hoàn thành
        if (booking.booking_status !== 'confirmed' && booking.booking_status !== 'reserved') {
            return res.status(400).json({
                success: false,
                message: `Không thể hoàn thành với trạng thái: ${booking.booking_status}. Chỉ có thể hoàn thành khi booking đã được xác nhận.`
            });
        }

        // Kiểm tra room có tồn tại không
        if (!booking.hotel_room_id) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phòng khách sạn'
            });
        }

        // Get hotelId before updating (since it's already populated)
        const hotelId = booking.hotel_room_id?.hotelId?._id || booking.hotel_room_id?.hotelId || null;

        if (!hotelId) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin khách sạn'
            });
        }

        // Update booking status to completed (WITHOUT transaction)
        booking.booking_status = 'completed';
        await booking.save({ validateBeforeSave: true }); // Validation sẽ skip vì status = completed

        // Reset room availability - remove booking from room's bookings array
        const Room = mongoose.model('Room');
        const roomId = booking.hotel_room_id._id || booking.hotel_room_id;

        await Room.findByIdAndUpdate(
            roomId,
            {
                $pull: {
                    bookings: { bookingId: booking._id }
                }
            }
        );
        await Room.findByIdAndUpdate(
            roomId,
            {
                $pull: {
                    bookings: { bookingId: booking._id }
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Hoàn thành booking thành công. Bạn có thể viết đánh giá cho khách sạn này.',
            data: {
                booking: {
                    _id: booking._id,
                    booking_status: booking.booking_status,
                    hotel_room_id: booking.hotel_room_id,
                    check_in_date: booking.check_in_date,
                    check_out_date: booking.check_out_date
                },
                hotelId: hotelId,
                canReview: true // Cho frontend biết có thể review
            }
        });

    } catch (error) {
        console.error('Complete Booking Error:', error);
        console.error('Error Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi hoàn thành booking',
            error: error.message
        });
    }
};

module.exports = exports;
