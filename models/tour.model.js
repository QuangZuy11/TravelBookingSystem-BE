const mongoose = require("mongoose");

const tourSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    highlights: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    duration_hours: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    rating: {
      type: String,
      default: "0",
    },
    total_rating: {
      type: String,
      default: "0",
    },
    included_services: {
      type: [String],
      default: [],
    },
    max_guests: {
      type: Number,
      default: 20,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discount_label: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "tours",
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

module.exports = mongoose.model("Tour", tourSchema);
