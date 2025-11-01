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
      required: false,
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // destination stored as a free-form string (name/place) instead of ObjectId
    destination: {
      type: String,
      required: false,
      default: null
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
    promotions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Promotion',
      },
    ],
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for itineraries (populate from Itinerary collection)
tourSchema.virtual('itineraries', {
  ref: 'ITINERARIES',
  localField: '_id',
  foreignField: 'tour_id'
});

module.exports = mongoose.model("Tour", tourSchema);
