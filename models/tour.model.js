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
      required: false // Flexible duration format: "3 days 2 nights", "5 hours", etc.
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    total_rating: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      required: true,
    },

    // ===== NEW FIELDS =====

    status: {
      type: String,
      enum: ['draft', 'active', 'inactive', 'archived'],
      default: 'draft'
    },

    capacity: {
      min_participants: {
        type: Number,
        default: 1,
        min: 0
      },
      max_participants: {
        type: Number,
        required: true,
        min: 1
      },
      current_participants: {
        type: Number,
        default: 0,
        min: 0
      }
    },

    booking_info: {
      booking_deadline: {
        type: Number, // hours before start
        default: 24
      },
      cancellation_policy: {
        type: String,
        default: 'Free cancellation up to 24 hours before the tour starts'
      },
      min_age: {
        type: Number,
        default: 0
      },
      max_age: {
        type: Number,
        default: 100
      },
      requires_guide: {
        type: Boolean,
        default: true
      }
    },

    pricing: {
      base_price: {
        type: Number,
        required: false
      },
      adult: {
        type: Number,
        required: false
      },
      child: {
        type: Number,
        required: false,
        default: 0 // Simple default, no complex function
      },
      infant: {
        type: Number,
        required: false,
        default: 0
      },
      currency: {
        type: String,
        default: 'VND',
        enum: ['VND', 'USD', 'EUR']
      },
      group_discount: {
        min_people: {
          type: Number,
          default: 10
        },
        discount_percent: {
          type: Number,
          default: 10,
          min: 0,
          max: 100
        }
      }
    },

    services: {
      included: [{
        type: String,
        trim: true
      }],
      excluded: [{
        type: String,
        trim: true
      }]
    },

    difficulty: {
      type: String,
      enum: ['easy', 'moderate', 'challenging', 'difficult'],
      default: 'easy'
    },

    languages_offered: [{
      type: String,
      default: ['English', 'Vietnamese']
    }],

    meeting_point: {
      address: {
        type: String,
        required: true
      },
      instructions: {
        type: String
      }
    },

    highlights: [{
      type: String
    }],

    what_to_bring: [{
      type: String
    }],

    accessibility: {
      wheelchair_accessible: {
        type: Boolean,
        default: false
      },
      suitable_for_elderly: {
        type: Boolean,
        default: true
      },
      suitable_for_children: {
        type: Boolean,
        default: true
      }
    },

    // Available tour dates (không dùng Schedule)
    available_dates: [{
      date: {
        type: Date,
        required: true
      },
      available_slots: {
        type: Number,
        required: true
      },
      booked_slots: {
        type: Number,
        default: 0
      },
      status: {
        type: String,
        enum: ['available', 'full', 'cancelled'],
        default: 'available'
      },
      guide_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      special_notes: String
    }],

    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    }
  },
  {
    collection: "tours",
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

// Indexes for better query performance
tourSchema.index({ provider_id: 1, status: 1 });
tourSchema.index({ location: 1, status: 1 });
tourSchema.index({ rating: -1 });
tourSchema.index({ 'pricing.base_price': 1, status: 1 });
tourSchema.index({ difficulty: 1, status: 1 });
tourSchema.index({ created_at: -1 });
tourSchema.index({ 'available_dates.date': 1, 'available_dates.status': 1 });

// Virtual for available slots
tourSchema.virtual('available_slots').get(function () {
  return this.capacity.max_participants - this.capacity.current_participants;
});

// Virtual for is_available
tourSchema.virtual('is_available').get(function () {
  return this.status === 'active' && this.available_slots > 0;
});

// Pre-save middleware to sync pricing
tourSchema.pre('save', function (next) {
  // If main 'price' field is set but pricing structure is empty, use it
  if (this.price && !this.pricing.base_price && !this.pricing.adult) {
    this.pricing.base_price = this.price;
    this.pricing.adult = this.price;
  }

  // Sync pricing structures
  if (this.pricing.adult && !this.pricing.base_price) {
    this.pricing.base_price = this.pricing.adult;
  } else if (this.pricing.base_price && !this.pricing.adult) {
    this.pricing.adult = this.pricing.base_price;
  }

  // Validate at least one price is set (check main price too)
  if (!this.pricing.base_price && !this.pricing.adult && !this.price) {
    return next(new Error('Price is required'));
  }

  // Auto-calculate child price if not set
  const basePrice = this.pricing.adult || this.pricing.base_price || this.price;
  if (!this.pricing.child || this.pricing.child === 0) {
    this.pricing.child = Math.round(basePrice * 0.7);
  }

  // Auto-calculate infant price if not set
  if (!this.pricing.infant || this.pricing.infant === 0) {
    this.pricing.infant = Math.round(basePrice * 0.3);
  }

  // Sync with main price field
  if (!this.price) {
    this.price = basePrice;
  }

  // Validate capacity
  if (this.capacity.current_participants > this.capacity.max_participants) {
    return next(new Error('Current participants cannot exceed max participants'));
  }

  next();
});

// Ensure virtuals are included in JSON
tourSchema.set('toJSON', { virtuals: true });
tourSchema.set('toObject', { virtuals: true });

// Virtual for itineraries
tourSchema.virtual('itineraries', {
  ref: 'Itinerary',
  localField: '_id',
  foreignField: 'tour_id' // Fixed: match Itinerary model field name
});

// Virtual for bookings
tourSchema.virtual('bookings', {
  ref: 'TourBooking',
  localField: '_id',
  foreignField: 'tour_id'
});

// Virtual for reviews (if needed)
tourSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'reference_id',
  match: { reference_type: 'tour' }
});

// Instance method to add available date
tourSchema.methods.addAvailableDate = function (date, slots, guideId = null) {
  this.available_dates.push({
    date: date,
    available_slots: slots,
    booked_slots: 0,
    status: 'available',
    guide_id: guideId
  });
  return this.save();
};

// Instance method to book slots for a date
tourSchema.methods.bookSlots = function (date, slotsToBook) {
  const dateEntry = this.available_dates.find(d =>
    d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
  );

  if (!dateEntry) {
    throw new Error('Date not available');
  }

  if (dateEntry.available_slots - dateEntry.booked_slots < slotsToBook) {
    throw new Error('Not enough slots available');
  }

  dateEntry.booked_slots += slotsToBook;

  if (dateEntry.booked_slots >= dateEntry.available_slots) {
    dateEntry.status = 'full';
  }

  return this.save();
};

// Instance method to cancel booking slots
tourSchema.methods.cancelBookingSlots = function (date, slotsToCan) {
  const dateEntry = this.available_dates.find(d =>
    d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
  );

  if (!dateEntry) {
    throw new Error('Date not found');
  }

  dateEntry.booked_slots -= slotsToCan;

  if (dateEntry.booked_slots < dateEntry.available_slots && dateEntry.status === 'full') {
    dateEntry.status = 'available';
  }

  return this.save();
};

// Static method to find available tours by date
tourSchema.statics.findAvailableByDate = function (date) {
  return this.find({
    status: 'active',
    'available_dates': {
      $elemMatch: {
        date: {
          $gte: new Date(date),
          $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
        },
        status: 'available'
      }
    }
  });
};

module.exports = mongoose.model("Tour", tourSchema, "TOURS");
