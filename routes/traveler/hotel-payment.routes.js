const express = require('express');
const router = express.Router();
const hotelPaymentController = require('../../controllers/traveler/hotel-payment.controller');
const { authenticateUser } = require('../../middlewares/auth.middleware');

/**
 * Hotel Payment Routes for Travelers
 * Tất cả routes yêu cầu authentication
 */

/**
 * @route   POST /api/traveler/hotel-payments/create
 * @desc    Tạo payment link PayOS cho hotel booking
 * @access  Private
 */
router.post('/create',
    authenticateUser,
    hotelPaymentController.createHotelPayment
);

/**
 * @route   GET /api/traveler/hotel-payments/:paymentId/status
 * @desc    Kiểm tra trạng thái thanh toán (polling)
 * @access  Private
 */
router.get('/:paymentId/status',
    authenticateUser,
    hotelPaymentController.getHotelPaymentStatus
);

/**
 * @route   POST /api/traveler/hotel-payments/:paymentId/cancel
 * @desc    Hủy payment khi user đóng modal
 * @access  Private
 */
router.post('/:paymentId/cancel',
    authenticateUser,
    hotelPaymentController.cancelHotelPayment
);

/**
 * @route   GET /api/traveler/hotel-payments
 * @desc    Lấy danh sách payments của user
 * @access  Private
 * @query   status (optional), page, limit
 */
router.get('/',
    authenticateUser,
    hotelPaymentController.getUserHotelPayments
);

module.exports = router;
