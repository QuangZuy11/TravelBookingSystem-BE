// models/AdBooking.js
const mongoose = require("mongoose");

const adBookingSchema = new mongoose.Schema({
  tour_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tour",
    required: true,
  },
  description: {
    type: Array,
    required: true,
  },
  advertisement_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Advertisement",
    required: true,
  },
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
    required: true,
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "active", "rejected", "expired"],
    default: "pending",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});
module.exports = mongoose.model("AdBooking", adBookingSchema, "AD_BOOKINGS");
