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
      required: false
    },
    duration: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'moderate', 'challenging', 'difficult'],
      default: 'easy'
    },
    meeting_point: {
      address: {
        type: String,
        required: true
      },
      instructions: {
        type: String,
        required: false
      }
    },
    capacity: {
      max_participants: {
        type: Number,
        required: true,
        min: 1
      },
      min_participants: {
        type: Number,
        required: true,
        min: 1
      }
    },
    available_dates: [{
      date: {
        type: Date,
        required: true
      },
      available_slots: {
        type: Number,
        required: true,
        min: 0,
        default: function () { return this.parent().capacity.max_participants; }
      },
      price: {
        type: Number,
        required: true,
        min: [1000, 'Price must be at least 1,000 VND']
      },
      status: {
        type: String,
        enum: ['available', 'full', 'cancelled'],
        default: 'available'
      }
    }],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
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
    departure_date: {
      type: Date,
      default: null
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
