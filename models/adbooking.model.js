const mongoose = require("mongoose");

const adBookingSchema = new mongoose.Schema(
  {
    tour_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      enum: ["active", "inactive", "expired"],
      default: "active",
    },
    price: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "AD_BOOKINGS", // ← QUAN TRỌNG: Chỉ định đúng tên collection
  }
);

module.exports = mongoose.model("AdBooking", adBookingSchema);
