const mongoose = require('mongoose');


const hotelBookingSchema = new mongoose.Schema({
    // ID phòng khách sạn được đặt
    hotel_room_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: [true, 'ID phòng khách sạn là bắt buộc']
    },

    // ID người dùng đặt phòng
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'ID người dùng là bắt buộc']
    },


    // Ngày đặt phòng (thời điểm tạo booking)
    booking_date: {
        type: Date,
        default: Date.now
    },

    // Ngày nhận phòng
    check_in_date: {
        type: Date,
        required: [true, 'Ngày check-in là bắt buộc'],
        validate: {
            validator: function (value) {
                // Skip validation nếu booking đã completed hoặc cancelled
                if (this.booking_status === 'completed' || this.booking_status === 'cancelled') {
                    return true;
                }
                // Chỉ validate ngày tương lai cho booking mới
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return value >= today;
            },
            message: 'Ngày check-in phải từ hôm nay trở đi'
        }
    },

    // Ngày trả phòng
    check_out_date: {
        type: Date,
        required: [true, 'Ngày check-out là bắt buộc'],
        validate: {
            validator: function (value) {
                return value > this.check_in_date;
            },
            message: 'Ngày check-out phải sau ngày check-in'
        }
    },

    // Tổng số tiền phải trả
    total_amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: [true, 'Tổng số tiền là bắt buộc'],
        get: function (value) {
            if (value) {
                return parseFloat(value.toString());
            }
            return value;
        }
    },

    // Trạng thái thanh toán
    payment_status: {
        type: String,
        enum: {
            values: ['pending', 'paid', 'refunded', 'failed'],
            message: '{VALUE} không phải trạng thái thanh toán hợp lệ'
        },
        default: 'pending'
    },

    // Trạng thái đặt phòng
    booking_status: {
        type: String,
        enum: {
            values: ['reserved', 'pending', 'confirmed', 'in_use', 'completed', 'cancelled'],
            message: '{VALUE} không phải trạng thái đặt phòng hợp lệ'
        },
        default: 'pending'
    },

    // Ngày check-in thực tế (khi khách nhận phòng)
    actual_check_in_date: {
        type: Date
    },

    // Ngày check-out thực tế (khi khách trả phòng)
    actual_check_out_date: {
        type: Date
    },

    // Thời gian hết hạn giữ phòng (cho status 'reserved')
    // Tự động hủy sau 5 phút nếu không thanh toán
    reserve_expire_time: {
        type: Date
    },

    // Ngày hủy
    cancelled_at: {
        type: Date
    },

    // Thời gian tạo
    created_at: {
        type: Date,
        default: Date.now
    },

    // Thời gian cập nhật
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    toJSON: { getters: true }, // Áp dụng getters khi chuyển sang JSON
    toObject: { getters: true }
});

// Index để tối ưu tìm kiếm
hotelBookingSchema.index({ user_id: 1, booking_date: -1 });
hotelBookingSchema.index({ hotel_room_id: 1, check_in_date: 1, check_out_date: 1 });
hotelBookingSchema.index({ booking_status: 1, payment_status: 1 });

// Middleware: Cập nhật updated_at trước khi save
hotelBookingSchema.pre('save', function (next) {
    this.updated_at = Date.now();
    next();
});

// Middleware: Kiểm tra phòng có sẵn không trước khi save
hotelBookingSchema.pre('save', async function (next) {
    if (this.isNew) {
        const Room = mongoose.model('Room');
        const room = await Room.findById(this.hotel_room_id);

        if (!room) {
            return next(new Error('Phòng không tồn tại'));
        }

        // Kiểm tra room có đang maintenance không
        if (room.status === 'maintenance') {
            return next(new Error('Phòng đang trong trạng thái bảo trì'));
        }

        // Nếu booking status là 'reserved', set thời gian hết hạn 2 phút
        if (this.booking_status === 'reserved') {
            this.reserve_expire_time = new Date(Date.now() + 2 * 60 * 1000); // 2 phút
        }

        // Kiểm tra phòng có conflict về thời gian không (sử dụng static method)
        const { isAvailable } = await this.constructor.checkRoomAvailability(
            this.hotel_room_id,
            this.check_in_date,
            this.check_out_date
        );

        if (!isAvailable) {
            return next(new Error('Phòng đã được đặt trong khoảng thời gian này'));
        }
    }

    // Kiểm tra quan hệ 1:1 với Payment
    if (this.isModified('payment_id') && this.payment_id) {
        const Payment = mongoose.model('Payment');
        const payment = await Payment.findById(this.payment_id);

        if (payment && payment.booking_id && !payment.booking_id.equals(this._id)) {
            return next(new Error('Payment này đã được link với booking khác'));
        }
    }

    next();
});

// Middleware: Cập nhật bookings trong Room model
hotelBookingSchema.post('save', async function (doc) {
    const Room = mongoose.model('Room');

    // Chỉ thêm booking vào room's bookings array (không update status)
    await Room.findByIdAndUpdate(doc.hotel_room_id, {
        $addToSet: {
            bookings: {
                bookingId: doc._id,
                checkIn: doc.check_in_date,
                checkOut: doc.check_out_date
            }
        }
    });
});

// Method: Tính số đêm
hotelBookingSchema.methods.calculateNights = function () {
    const checkIn = new Date(this.check_in_date);
    const checkOut = new Date(this.check_out_date);
    const diffTime = Math.abs(checkOut - checkIn);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Method: Kiểm tra có thể hủy không
hotelBookingSchema.methods.canCancel = function () {
    const now = new Date();
    const checkIn = new Date(this.check_in_date);
    const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);

    // Có thể hủy nếu còn hơn 24 giờ trước check-in
    return hoursUntilCheckIn > 24 && this.booking_status !== 'cancelled';
};

// Method: Hủy booking
hotelBookingSchema.methods.cancelBooking = async function (reason) {
    if (!this.canCancel()) {
        throw new Error('Không thể hủy booking này');
    }

    this.booking_status = 'cancelled';
    this.cancellation_reason = reason;
    this.cancelled_at = new Date();

    // Cập nhật trạng thái thanh toán nếu đã thanh toán
    if (this.payment_status === 'paid' && this.payment_id) {
        this.payment_status = 'refunded';

        // Xử lý refund payment
        const Payment = mongoose.model('Payment');
        const payment = await Payment.findById(this.payment_id);
        if (payment) {
            await payment.processRefund(reason);
        }
    }

    await this.save();

    // Xóa booking khỏi room
    const Room = mongoose.model('Room');
    await Room.findByIdAndUpdate(this.hotel_room_id, {
        $pull: {
            bookings: { bookingId: this._id }
        }
    });
};

// Method: Link payment với booking (đảm bảo 1:1)
hotelBookingSchema.methods.linkPayment = async function (paymentId) {
    const Payment = mongoose.model('Payment');
    const payment = await Payment.findById(paymentId);

    if (!payment) {
        throw new Error('Payment không tồn tại');
    }

    if (payment.booking_id && !payment.booking_id.equals(this._id)) {
        throw new Error('Payment đã được link với booking khác');
    }

    // Update booking
    this.payment_id = paymentId;
    this.payment_status = payment.status === 'completed' ? 'paid' : 'pending';

    // Update payment
    payment.booking_id = this._id;

    await Promise.all([this.save(), payment.save()]);

    return this;
};

// Static method: Tìm bookings theo user
hotelBookingSchema.statics.findByUser = function (userId, options = {}) {
    const query = { user_id: userId };

    if (options.status) {
        query.booking_status = options.status;
    }

    return this.find(query)
        .populate('hotel_room_id')
        .populate('user_id', 'name email phone')
        .populate('payment_id')
        .sort({ booking_date: -1 });
};

// Static method: Tìm bookings theo phòng
hotelBookingSchema.statics.findByRoom = function (roomId, options = {}) {
    const query = { hotel_room_id: roomId };

    if (options.startDate && options.endDate) {
        query.$or = [
            {
                check_in_date: { $lt: options.endDate },
                check_out_date: { $gt: options.startDate }
            }
        ];
    }

    return this.find(query)
        .populate('user_id', 'name email phone')
        .sort({ check_in_date: 1 });
};

// Static method: Kiểm tra phòng có available trong khoảng thời gian không
hotelBookingSchema.statics.checkRoomAvailability = async function (roomId, checkInDate, checkOutDate, excludeBookingId = null) {
    const query = {
        hotel_room_id: roomId,
        booking_status: { $in: ['reserved', 'confirmed'] },
        $or: [
            // Case 1: Booking hiện tại bắt đầu trước check-out của booking mới và kết thúc sau check-in của booking mới
            {
                check_in_date: { $lt: checkOutDate },
                check_out_date: { $gt: checkInDate }
            }
        ]
    };

    // Nếu đang update booking, bỏ qua chính booking đó
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    const conflictBookings = await this.find(query);

    return {
        isAvailable: conflictBookings.length === 0,
        conflictBookings: conflictBookings
    };
};

// Virtual: Tính tổng số khách
hotelBookingSchema.virtual('total_guests').get(function () {
    return this.number_of_guests.adults + this.number_of_guests.children;
});

module.exports = mongoose.model('HotelBooking', hotelBookingSchema, 'HOTEL_BOOKINGS');
