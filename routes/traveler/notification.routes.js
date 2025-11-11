const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/traveler/notification.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

/**
 * @route   GET /api/traveler/notifications
 * @desc    Lấy danh sách thông báo của user
 * @access  Private
 * @query   {String} status - Trạng thái (read/unread), null = tất cả
 * @query   {Number} page - Trang hiện tại (default: 1)
 * @query   {Number} limit - Số lượng mỗi trang (default: 50)
 */
router.get('/', authMiddleware, notificationController.getNotifications);

/**
 * @route   GET /api/traveler/notifications/unread-count
 * @desc    Lấy số thông báo chưa đọc
 * @access  Private
 */
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);

/**
 * @route   PUT /api/traveler/notifications/:id/read
 * @desc    Đánh dấu thông báo đã đọc
 * @access  Private
 */
router.put('/:id/read', authMiddleware, notificationController.markAsRead);

/**
 * @route   PUT /api/traveler/notifications/read-all
 * @desc    Đánh dấu tất cả thông báo đã đọc
 * @access  Private
 */
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);

module.exports = router;

