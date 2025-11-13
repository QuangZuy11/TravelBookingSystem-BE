const mongoose = require('mongoose');

const aiGeneratedItinerarySchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AiItineraryRequest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Add user_id for direct queries
  destination: { type: String, required: true }, // Destination name for listing
  duration_days: { type: Number, required: true }, // Duration for display
  budget_total: { type: Number, required: true }, // Budget for display
  participant_number: { type: Number, required: true }, // Travelers count
  preferences: [{ type: String }], // User preferences
  itinerary_data: { type: Object }, // full generated structure
  summary: { type: String },
  status: { type: String, enum: ['done', 'failed', 'custom'], default: 'done' },

  // ✅ Booking tracking
  booking_count: { type: Number, default: 0 },
  total_bookings: { type: Number, default: 0 },

  // ✅ Enable/disable booking
  is_bookable: { type: Boolean, default: true },

  // ✅ Provider preferences
  preferred_providers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider'
  }],

  // ✅ Pricing info
  estimated_price_range: {
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, default: 'VND' }
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

aiGeneratedItinerarySchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

// ✅ Method để check booking availability
aiGeneratedItinerarySchema.methods.isAvailableForBooking = function () {
  return this.is_bookable && (this.status === 'done' || this.status === 'custom');
};

// ✅ Method để increment booking count
aiGeneratedItinerarySchema.methods.incrementBookingCount = async function () {
  this.booking_count += 1;
  this.total_bookings += 1;
  return this.save();
};

aiGeneratedItinerarySchema.set('toJSON', { virtuals: true });
aiGeneratedItinerarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AiGeneratedItinerary', aiGeneratedItinerarySchema, 'AI_GENERATED_ITINERARIES');
