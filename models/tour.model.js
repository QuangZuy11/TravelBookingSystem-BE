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
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    destination_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true // Tour PHẢI thuộc một destination
    },
    price: {
      type: Number,
      required: true,
      min: [1000, 'Price must be at least 1,000 VND']
    },
    duration_hours: {
      type: String,
      required: false // Made optional, can use 'duration' instead
    },
    duration: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      default: 0,
    },
    total_rating: {
      type: Number,
      default: 0,
    },
    included_services: {
      type: [String],
      default: [],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    itinerary: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Itinerary",
      },
    ],
  },

  {
    collection: "TOURS",
    versionKey: false,
  }
);

module.exports = mongoose.model("Tour", tourSchema);
