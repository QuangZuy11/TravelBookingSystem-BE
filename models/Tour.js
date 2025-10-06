const mongoose = require("mongoose");

const tourSchema = new mongoose.Schema({
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: [String],
    default: [],
  },
  destination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Destination",
    required: true,
  },
  duration: {
    days: {
      type: Number,
      required: true,
    },
    nights: {
      type: Number,
      required: true,
    },
  },
  price: {
    type: Number,
    required: true,
  },
  max_participants: {
    type: Number,
    required: true,
  },
  start_location: {
    type: String,
    required: true,
  },
  end_location: {
    type: String,
    required: true,
  },
  included_services: [
    {
      type: String,
    },
  ],
  itinerary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Itinerary",
  },
  images: [
    {
      type: String,
    },
  ],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "cancelled"],
    default: "active",
  },
  difficulty_level: {
    type: String,
    enum: ["easy", "moderate", "challenging"],
    required: true,
  },
  tour_type: {
    type: String,
    enum: ["adventure", "cultural", "nature", "city", "beach", "mountain"],
    required: true,
  },
  special_notes: String,
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Tour", tourSchema);
