const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // ID người dùng nhận thông báo
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'ID người dùng là bắt buộc'],
        index: true
    },

    // Tiêu đề thông báo
    title: {
        type: String,
        required: [true, 'Tiêu đề thông báo là bắt buộc'],
        trim: true
    },

    // Nội dung thông báo
    message: {
        type: String,
        required: [true, 'Nội dung thông báo là bắt buộc'],
        trim: true
    },

    // Loại thông báo: 'success', 'info', 'warning', 'error'
    type: {
        type: String,
        enum: {
            values: ['success', 'info', 'warning', 'error'],
            message: '{VALUE} không phải loại thông báo hợp lệ'
        },
        default: 'info'
    },

    // Trạng thái đọc: 'read', 'unread'
    status: {
        type: String,
        enum: {
            values: ['read', 'unread'],
            message: '{VALUE} không phải trạng thái hợp lệ'
        },
        default: 'unread',
        index: true
    },

    // ID của đối tượng liên quan (booking, payment, etc.)
    related_id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'related_type'
    },

    // Loại đối tượng liên quan: 'HotelBooking', 'TourBooking', 'Payment', 'AdBooking'
    related_type: {
        type: String,
        enum: {
            values: ['HotelBooking', 'TourBooking', 'HotelPayment', 'TourPayment', 'AdBooking'],
            message: '{VALUE} không phải loại đối tượng hợp lệ'
        }
    },

    // Metadata bổ sung (optional)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Thời gian đọc (nếu đã đọc)
    read_at: {
        type: Date
    },

    // Thời gian tạo
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Thời gian cập nhật
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index để tối ưu tìm kiếm
notificationSchema.index({ user_id: 1, status: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, created_at: -1 });

// Middleware: Cập nhật updated_at trước khi save
notificationSchema.pre('save', function (next) {
    this.updated_at = Date.now();
    if (this.status === 'read' && !this.read_at) {
        this.read_at = new Date();
    }
    next();
});

// Static method: Tạo thông báo
notificationSchema.statics.createNotification = async function (data) {
    try {
        const notification = new this(data);
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Static method: Lấy thông báo của user
notificationSchema.statics.getUserNotifications = async function (userId, options = {}) {
    const {
        status = null,
        limit = 50,
        skip = 0,
        sort = { created_at: -1 }
    } = options;

    const query = { user_id: userId };
    if (status) {
        query.status = status;
    }

    const notifications = await this.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean();

    return notifications;
};

// Static method: Đếm số thông báo chưa đọc
notificationSchema.statics.getUnreadCount = async function (userId) {
    return await this.countDocuments({
        user_id: userId,
        status: 'unread'
    });
};

// Static method: Đánh dấu đã đọc
notificationSchema.statics.markAsRead = async function (notificationId, userId) {
    return await this.findOneAndUpdate(
        {
            _id: notificationId,
            user_id: userId
        },
        {
            status: 'read',
            read_at: new Date()
        },
        {
            new: true
        }
    );
};

// Static method: Đánh dấu tất cả đã đọc
notificationSchema.statics.markAllAsRead = async function (userId) {
    return await this.updateMany(
        {
            user_id: userId,
            status: 'unread'
        },
        {
            status: 'read',
            read_at: new Date()
        }
    );
};

module.exports = mongoose.model('Notification', notificationSchema, 'NOTIFICATIONS');

