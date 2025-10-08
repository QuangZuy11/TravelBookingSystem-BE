const mongoose = require("mongoose");

const tourSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: [String],
      required: true,
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
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
    rating: {
      type: String,
      default: "0",
    },
    total_rating: {
      type: String,
      default: "0",
    },
    image: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "tours",
  }
);

module.exports = mongoose.model("Tour", tourSchema);
