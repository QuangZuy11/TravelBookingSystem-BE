const Notification = require('../../models/notification.model');
const authMiddleware = require('../../middlewares/auth.middleware');

/**
 * Notification Controller
 * Xử lý các API liên quan đến thông báo
 */

/**
 * Lấy danh sách thông báo của user
 * @route GET /api/traveler/notifications
 * @desc Lấy danh sách thông báo của user hiện tại
 * @access Private
 */
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, limit = 50, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const options = {
            status: status || null, // 'read' hoặc 'unread', null = tất cả
            limit: parseInt(limit),
            skip: skip,
            sort: { created_at: -1 }
        };

        const notifications = await Notification.getUserNotifications(userId, options);
        const total = await Notification.countDocuments({ user_id: userId });
        const unreadCount = await Notification.getUnreadCount(userId);

        // Format thông báo để trả về
        const formattedNotifications = notifications.map(notif => ({
            id: notif._id,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            isRead: notif.status === 'read',
            status: notif.status,
            time: formatTimeAgo(notif.created_at),
            createdAt: notif.created_at,
            relatedId: notif.related_id,
            relatedType: notif.related_type,
            metadata: notif.metadata || {}
        }));

        res.status(200).json({
            success: true,
            data: {
                notifications: formattedNotifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                },
                unreadCount
            },
            message: 'Lấy danh sách thông báo thành công'
        });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách thông báo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lấy số thông báo chưa đọc
 * @route GET /api/traveler/notifications/unread-count
 * @desc Lấy số thông báo chưa đọc của user hiện tại
 * @access Private
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;

        const unreadCount = await Notification.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            data: {
                unreadCount
            },
            message: 'Lấy số thông báo chưa đọc thành công'
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy số thông báo chưa đọc',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Đánh dấu thông báo đã đọc
 * @route PUT /api/traveler/notifications/:id/read
 * @desc Đánh dấu thông báo đã đọc
 * @access Private
 */
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const notification = await Notification.markAsRead(id, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                notification: {
                    id: notification._id,
                    status: notification.status
                }
            },
            message: 'Đánh dấu đã đọc thành công'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đánh dấu đã đọc',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Đánh dấu tất cả thông báo đã đọc
 * @route PUT /api/traveler/notifications/read-all
 * @desc Đánh dấu tất cả thông báo đã đọc
 * @access Private
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;

        const result = await Notification.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            data: {
                updatedCount: result.modifiedCount
            },
            message: `Đánh dấu ${result.modifiedCount} thông báo đã đọc thành công`
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đánh dấu tất cả đã đọc',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Format thời gian (time ago)
 */
function formatTimeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} ngày trước`;
    } else if (hours > 0) {
        return `${hours} giờ trước`;
    } else if (minutes > 0) {
        return `${minutes} phút trước`;
    } else {
        return 'Vừa xong';
    }
}

