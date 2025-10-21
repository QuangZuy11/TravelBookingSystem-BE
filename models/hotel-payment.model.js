const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Schema cho Payments Collection
 * Quản lý các giao dịch thanh toán
 * Quan hệ 1:1 với HotelBooking
 * Chỉ thanh toán số tiền phòng, không tính thuế hay phí
 */
const paymentSchema = new mongoose.Schema({
    // ID người dùng thực hiện thanh toán
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'ID người dùng là bắt buộc']
    },

    // ID booking (quan hệ 1:1, có thể null nếu thanh toán không liên quan đến booking)
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HotelBooking',
        default: null
    },

    // Số tiền thanh toán (chỉ tiền phòng, không tính thuế/phí)
    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: [true, 'Số tiền thanh toán là bắt buộc'],
        min: [0, 'Số tiền không thể âm'],
        get: function (value) {
            if (value) {
                return parseFloat(value.toString());
            }
            return value;
        }
    },

    // Đơn vị tiền tệ
    currency: {
        type: String,
        default: 'VND',
        enum: {
            values: ['VND', 'USD', 'EUR', 'GBP', 'JPY', 'CNY'],
            message: '{VALUE} không phải đơn vị tiền tệ hợp lệ'
        }
    },

    // Phương thức thanh toán
    method: {
        type: String,
        required: [true, 'Phương thức thanh toán là bắt buộc'],
        enum: {
            values: ['credit_card', 'debit_card', 'bank_transfer', 'paypal', 'momo', 'vnpay', 'zalopay', 'cash', 'crypto'],
            message: '{VALUE} không phải phương thức thanh toán hợp lệ'
        }
    },

    // Trạng thái thanh toán
    status: {
        type: String,
        enum: {
            values: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
            message: '{VALUE} không phải trạng thái thanh toán hợp lệ'
        },
        default: 'pending'
    },

    // Mã giao dịch (transaction reference)
    transaction_ref: {
        type: String,
        unique: true,
        sparse: true // Cho phép nhiều document có giá trị null
    },

    // Chi tiết thanh toán
    payment_details: {
        // Thông tin thẻ (đã mã hóa)
        card_info: {
            last_four: String, // 4 số cuối thẻ
            brand: String, // Visa, Mastercard, etc.
            exp_month: Number,
            exp_year: Number
        },

        // Thông tin ngân hàng
        bank_info: {
            bank_name: String,
            account_number: String // Đã mã hóa
        },

        // Thông tin ví điện tử
        ewallet_info: {
            provider: String, // MoMo, ZaloPay, etc.
            account_id: String
        },

        // IP address của người thanh toán
        ip_address: String,

        // User agent
        user_agent: String
    },

    // Mã xác thực từ cổng thanh toán
    gateway_transaction_id: {
        type: String
    },

    // Tên cổng thanh toán
    payment_gateway: {
        type: String,
        enum: ['vnpay', 'momo', 'zalopay', 'paypal', 'stripe', 'manual', 'other']
    },

    // Mô tả giao dịch
    description: {
        type: String,
        maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
    },

    // Ghi chú
    note: {
        type: String
    },

    // Lý do thất bại (nếu có)
    failure_reason: {
        type: String
    },

    // Lý do hoàn tiền (nếu có)
    refund_reason: {
        type: String
    },

    // Ngày hoàn tiền
    refunded_at: {
        type: Date
    },

    // ID giao dịch hoàn tiền (nếu đây là giao dịch hoàn tiền)
    refund_of: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },

    // Metadata bổ sung
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Thông tin xác thực
    verification: {
        is_verified: {
            type: Boolean,
            default: false
        },
        verified_at: Date,
        verified_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },

    // Webhooks từ payment gateway
    webhooks: [{
        event: String,
        data: mongoose.Schema.Types.Mixed,
        received_at: {
            type: Date,
            default: Date.now
        }
    }],

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
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Index để tối ưu tìm kiếm
paymentSchema.index({ user_id: 1, created_at: -1 });
paymentSchema.index({ booking_id: 1 });
paymentSchema.index({ transaction_ref: 1 });
paymentSchema.index({ status: 1, created_at: -1 });
paymentSchema.index({ payment_gateway: 1, status: 1 });

// Middleware: Tạo transaction reference tự động
paymentSchema.pre('save', function (next) {
    if (this.isNew && !this.transaction_ref) {
        // Tạo mã giao dịch duy nhất: PAY-YYYYMMDD-RANDOM
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        this.transaction_ref = `PAY-${dateStr}-${random}`;
    }

    // Kiểm tra quan hệ 1:1 với booking
    if (this.isModified('booking_id') && this.booking_id && !this.refund_of) {
        // Sẽ kiểm tra trong async middleware
        this._checkBookingPayment = true;
    }

    this.updated_at = Date.now();
    next();
});

// Middleware: Kiểm tra 1 booking chỉ có 1 payment chính
paymentSchema.pre('save', async function (next) {
    if (this._checkBookingPayment) {
        // Kiểm tra booking đã có payment chưa (trừ payment hiện tại)
        const existingPayment = await this.constructor.findOne({
            booking_id: this.booking_id,
            _id: { $ne: this._id },
            refund_of: null, // Chỉ kiểm tra payment chính, không tính refund
            status: { $nin: ['failed', 'cancelled'] } // Không tính payment failed
        });

        if (existingPayment) {
            return next(new Error('Booking này đã có payment. Một booking chỉ có thể có 1 payment chính.'));
        }
    }
    next();
});

// Middleware: Cập nhật payment_status của booking khi thanh toán thành công
paymentSchema.post('save', async function (doc) {
    if (doc.booking_id && doc.status === 'completed' && !doc.refund_of) {
        const HotelBooking = mongoose.model('HotelBooking');
        await HotelBooking.findByIdAndUpdate(doc.booking_id, {
            payment_id: doc._id,
            payment_status: 'paid',
            booking_status: 'confirmed'
        });
    }
});

// Method: Xác nhận thanh toán thành công
paymentSchema.methods.markAsCompleted = async function (gatewayTransactionId) {
    this.status = 'completed';
    this.gateway_transaction_id = gatewayTransactionId;
    this.verification.is_verified = true;
    this.verification.verified_at = new Date();

    await this.save();
};

// Method: Đánh dấu thanh toán thất bại
paymentSchema.methods.markAsFailed = async function (reason) {
    this.status = 'failed';
    this.failure_reason = reason;

    await this.save();
};

// Method: Hoàn tiền
paymentSchema.methods.processRefund = async function (reason) {
    if (this.status !== 'completed') {
        throw new Error('Chỉ có thể hoàn tiền cho giao dịch đã hoàn thành');
    }

    // Tạo giao dịch hoàn tiền mới
    const refundPayment = new this.constructor({
        user_id: this.user_id,
        booking_id: this.booking_id,
        amount: this.amount,
        currency: this.currency,
        method: this.method,
        status: 'completed',
        payment_gateway: this.payment_gateway,
        description: `Hoàn tiền cho giao dịch ${this.transaction_ref}`,
        refund_of: this._id,
        refund_reason: reason
    });

    await refundPayment.save();

    // Cập nhật trạng thái giao dịch gốc
    this.status = 'refunded';
    this.refund_reason = reason;
    this.refunded_at = new Date();

    await this.save();

    return refundPayment;
};

// Method: Thêm webhook event
paymentSchema.methods.addWebhook = async function (event, data) {
    this.webhooks.push({
        event,
        data,
        received_at: new Date()
    });

    await this.save();
};

// Method: Kiểm tra có phải payment chính không (không phải refund)
paymentSchema.methods.isPrimaryPayment = function () {
    return !this.refund_of;
};

// Static method: Tìm thanh toán theo user
paymentSchema.statics.findByUser = function (userId, options = {}) {
    const query = { user_id: userId };

    if (options.status) {
        query.status = options.status;
    }

    if (options.startDate && options.endDate) {
        query.created_at = {
            $gte: new Date(options.startDate),
            $lte: new Date(options.endDate)
        };
    }

    return this.find(query)
        .populate('booking_id')
        .populate('user_id', 'name email phone')
        .sort({ created_at: -1 });
};

// Static method: Tìm thanh toán theo booking
paymentSchema.statics.findByBooking = function (bookingId) {
    return this.find({ booking_id: bookingId })
        .populate('user_id', 'name email')
        .sort({ created_at: -1 });
};

// Static method: Lấy payment chính của booking (quan hệ 1:1)
paymentSchema.statics.findPrimaryByBooking = function (bookingId) {
    return this.findOne({
        booking_id: bookingId,
        refund_of: null,
        status: { $nin: ['failed', 'cancelled'] }
    }).populate('user_id', 'name email');
};

// Static method: Thống kê doanh thu
paymentSchema.statics.getRevenue = async function (options = {}) {
    const matchQuery = {
        status: 'completed',
        refund_of: null // Chỉ tính payment chính, không tính refund
    };

    if (options.startDate && options.endDate) {
        matchQuery.created_at = {
            $gte: new Date(options.startDate),
            $lte: new Date(options.endDate)
        };
    }

    if (options.paymentGateway) {
        matchQuery.payment_gateway = options.paymentGateway;
    }

    const result = await this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: { $toDouble: '$amount' } },
                totalTransactions: { $sum: 1 },
                avgTransaction: { $avg: { $toDouble: '$amount' } }
            }
        }
    ]);

    return result[0] || {
        totalRevenue: 0,
        totalTransactions: 0,
        avgTransaction: 0
    };
};

// Static method: Thống kê theo phương thức thanh toán
paymentSchema.statics.getStatsByMethod = async function (options = {}) {
    const matchQuery = {
        status: 'completed',
        refund_of: null // Chỉ tính payment chính
    };

    if (options.startDate && options.endDate) {
        matchQuery.created_at = {
            $gte: new Date(options.startDate),
            $lte: new Date(options.endDate)
        };
    }

    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$method',
                count: { $sum: 1 },
                totalAmount: { $sum: { $toDouble: '$amount' } }
            }
        },
        { $sort: { totalAmount: -1 } }
    ]);
};

// Virtual: Kiểm tra có phải giao dịch hoàn tiền không
paymentSchema.virtual('is_refund').get(function () {
    return this.refund_of !== null && this.refund_of !== undefined;
});

module.exports = mongoose.model('Payment', paymentSchema, 'PAYMENTS');
