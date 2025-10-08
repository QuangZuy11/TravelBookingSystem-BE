const express = require("express");
const router = express.Router();
const adBookingController = require("../controllers/adBooking.controller");
router.get("/active", adBookingController.getActiveAds);

module.exports = router;
