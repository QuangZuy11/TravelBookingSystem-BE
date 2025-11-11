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
      enum: ["pending", "active", "inactive", "expired", "cancelled"],
      default: "pending",
    },
    price: {
      type: Number,
      required: true,
      default: 300000, // 300,000 VND
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdPayment",
      default: null,
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "AD_BOOKINGS", // ← QUAN TRỌNG: Chỉ định đúng tên collection
  }
);

// Indexes for better query performance
adBookingSchema.index({ status: 1, start_date: 1, end_date: 1 });
adBookingSchema.index({ tour_id: 1 });
adBookingSchema.index({ provider_id: 1 });

module.exports = mongoose.model("AdBooking", adBookingSchema);
