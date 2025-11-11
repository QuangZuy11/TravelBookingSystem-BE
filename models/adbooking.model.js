const mongoose = require("mongoose");

const adBookingSchema = new mongoose.Schema(
  {
    // Type of ad: tour or hotel
    ad_type: {
      type: String,
      enum: ["tour", "hotel"],
      required: true,
      default: "tour",
    },
    // Tour ID (for tour ads) - optional now
    tour_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: function () {
        return this.ad_type === "tour";
      },
    },
    // Hotel ID (for hotel ads) - optional now
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: function () {
        return this.ad_type === "hotel";
      },
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
adBookingSchema.index({ ad_type: 1, status: 1, start_date: 1, end_date: 1 });
adBookingSchema.index({ tour_id: 1 });
adBookingSchema.index({ hotel_id: 1 });
adBookingSchema.index({ provider_id: 1 });

module.exports = mongoose.model("AdBooking", adBookingSchema);
