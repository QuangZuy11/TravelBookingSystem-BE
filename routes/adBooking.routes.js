const express = require("express");
const router = express.Router();
const adBookingController = require("../controllers/adBooking.controller");
const adPaymentController = require("../controllers/ad-payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireProvider } = require("../middlewares/provider-auth.middleware");

// Public routes
router.get("/active", adBookingController.getActiveAds);

// Protected routes (require provider authentication)
router.post(
  "/create",
  authMiddleware,
  requireProvider,
  adBookingController.createAdBooking
);

// Payment routes
router.get(
  "/payments/:paymentId/status",
  authMiddleware,
  requireProvider,
  adPaymentController.getPaymentStatus
);

router.post(
  "/payments/:paymentId/cancel",
  authMiddleware,
  requireProvider,
  adPaymentController.cancelPayment
);

module.exports = router;
