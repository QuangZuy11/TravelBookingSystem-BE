const mongoose = require("mongoose");

const tourBookingSchema = new mongoose.Schema(
  {
    booking_number: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    
    tour_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true
    },
    
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
      required: true
    },
    
    // Booking details
    booking_date: {
      type: Date,
      default: Date.now
    },
    
    tour_date: {
      type: Date,
      required: true
    },
    
    status: {
      type: String,
      enum: [
        'pending',       // Chờ xác nhận
        'confirmed',     // Đã xác nhận
        'paid',          // Đã thanh toán
        'in_progress',   // Đang diễn ra
        'completed',     // Hoàn thành
        'cancelled',     // Đã hủy
        'refunded'       // Đã hoàn tiền
      ],
      default: 'pending'
    },
    
    // Participants information
    participants: {
      adults: {
        type: Number,
        required: true,
        min: 0,
        default: 1
      },
      children: {
        type: Number,
        default: 0,
        min: 0
      },
      infants: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    
    total_participants: {
      type: Number,
      required: true,
      min: 1
    },
    
    // Detailed participant information
    participant_details: [{
      full_name: {
        type: String,
        required: true
      },
      age: {
        type: Number,
        required: true,
        min: 0
      },
      type: {
        type: String,
        enum: ['adult', 'child', 'infant'],
        required: true
      },
      gender: {
        type: String,
        enum: ['male', 'female', 'other']
      },
      id_number: {
        type: String
      },
      special_requirements: {
        type: String
      }
    }],
    
    // Pricing breakdown
    pricing: {
      adult_price: {
        type: Number,
        required: true
      },
      child_price: {
        type: Number,
        default: 0
      },
      infant_price: {
        type: Number,
        default: 0
      },
      subtotal: {
        type: Number,
        required: true
      },
      discount: {
        type: Number,
        default: 0
      },
      discount_code: {
        type: String
      },
      tax: {
        type: Number,
        default: 0
      },
      service_fee: {
        type: Number,
        default: 0
      },
      total_amount: {
        type: Number,
        required: true
      }
    },
    
    // Payment information
    payment: {
      method: {
        type: String,
        enum: ['credit_card', 'debit_card', 'bank_transfer', 'e_wallet', 'cash', 'paypal'],
        required: true
      },
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
      },
      transaction_id: {
        type: String
      },
      paid_at: {
        type: Date
      },
      refund_amount: {
        type: Number,
        default: 0
      },
      refund_date: {
        type: Date
      }
    },
    
    // Cancellation information
    cancellation: {
      is_cancelled: {
        type: Boolean,
        default: false
      },
      cancelled_at: {
        type: Date
      },
      cancelled_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      cancellation_reason: {
        type: String
      },
      refund_percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    },
    
    // Contact information
    contact_info: {
      phone: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      emergency_contact: {
        name: String,
        phone: String,
        relationship: String
      }
    },
    
    // Special requests
    special_requests: {
      type: String,
      maxlength: 1000
    },
    
    dietary_requirements: [{
      type: String,
      enum: ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'lactose_free', 'nut_allergy', 'other']
    }],
    
    // Pickup information
    pickup_info: {
      required: {
        type: Boolean,
        default: false
      },
      location: {
        address: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      time: Date
    },
    
    // Review
    review_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review"
    },
    
    // Notes from provider
    provider_notes: {
      type: String
    },
    
    // Confirmation
    confirmed_at: {
      type: Date
    },
    
    confirmed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider"
    },
    
    created_at: {
      type: Date,
      default: Date.now
    },
    
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: "tour_bookings",
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

// Indexes for better query performance
tourBookingSchema.index({ booking_number: 1 }, { unique: true });
tourBookingSchema.index({ customer_id: 1, status: 1 });
tourBookingSchema.index({ tour_id: 1, tour_date: 1 });
tourBookingSchema.index({ provider_id: 1, status: 1 });
tourBookingSchema.index({ booking_date: -1 });
tourBookingSchema.index({ 'payment.status': 1 });

// Pre-save middleware to calculate total participants
tourBookingSchema.pre('save', function(next) {
  if (this.isModified('participants')) {
    this.total_participants = 
      this.participants.adults + 
      this.participants.children + 
      this.participants.infants;
  }
  next();
});

// Static method to generate booking number
tourBookingSchema.statics.generateBookingNumber = async function() {
  const prefix = 'TB';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Find the last booking number for today
  const lastBooking = await this.findOne({
    booking_number: new RegExp(`^${prefix}${year}${month}`)
  }).sort({ booking_number: -1 });
  
  let sequence = 1;
  if (lastBooking) {
    const lastSequence = parseInt(lastBooking.booking_number.slice(-6));
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${year}${month}${sequence.toString().padStart(6, '0')}`;
};

// Instance method to calculate refund amount
tourBookingSchema.methods.calculateRefund = function() {
  const hoursUntilTour = (this.tour_date - new Date()) / (1000 * 60 * 60);
  let refundPercentage = 0;
  
  if (hoursUntilTour > 72) {
    refundPercentage = 100;
  } else if (hoursUntilTour > 48) {
    refundPercentage = 75;
  } else if (hoursUntilTour > 24) {
    refundPercentage = 50;
  } else if (hoursUntilTour > 12) {
    refundPercentage = 25;
  }
  
  return {
    refund_percentage: refundPercentage,
    refund_amount: (this.pricing.total_amount * refundPercentage) / 100
  };
};

// Instance method to check if booking can be cancelled
tourBookingSchema.methods.canBeCancelled = function() {
  const validStatuses = ['pending', 'confirmed', 'paid'];
  const hoursUntilTour = (this.tour_date - new Date()) / (1000 * 60 * 60);
  
  return validStatuses.includes(this.status) && hoursUntilTour > 0;
};

module.exports = mongoose.model("TourBooking", tourBookingSchema);
