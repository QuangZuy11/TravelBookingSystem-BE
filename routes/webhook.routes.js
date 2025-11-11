const express = require("express");
const router = express.Router();
const hotelPayOSWebhook = require("../controllers/webhooks/hotel-payos.webhook");
const tourPayOSWebhook = require("../controllers/webhooks/tour-payos.webhook");
const adPayOSWebhook = require("../controllers/webhooks/ad-payos.webhook");

/**
 * Webhook Routes
 * Public endpoints cho PayOS callback (không cần authentication)
 */

/**
 * @route   POST /api/webhooks/hotel-payos
 * @desc    Webhook endpoint để PayOS gọi khi có update về payment
 * @access  Public (có signature verification)
 */
router.post("/hotel-payos", hotelPayOSWebhook.handleHotelPayOSWebhook);

/**
 * @route   POST /api/webhooks/hotel-payos/test
 * @desc    Test webhook handler (development only)
 * @access  Public (development only)
 */
router.post("/hotel-payos/test", hotelPayOSWebhook.testHotelPayOSWebhook);

/**
 * @route   POST /api/webhooks/tour-payos
 * @desc    Webhook endpoint để PayOS gọi khi có update về tour payment
 * @access  Public (có signature verification)
 */
router.post("/tour-payos", tourPayOSWebhook.handleTourPayOSWebhook);

/**
 * @route   POST /api/webhooks/tour-payos/test
 * @desc    Test webhook handler (development only)
 * @access  Public (development only)
 */
router.post("/tour-payos/test", tourPayOSWebhook.testTourPayOSWebhook);

/**
 * @route   POST /api/webhooks/ad-payos
 * @desc    Webhook endpoint để PayOS gọi khi có update về ad payment
 * @access  Public (có signature verification)
 */
router.post("/ad-payos", adPayOSWebhook.handleAdPayOSWebhook);

module.exports = router;
