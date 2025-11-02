const mongoose = require('mongoose');

const aiGeneratedItinerarySchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AiItineraryRequest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Add user_id for direct queries
  destination: { type: String, required: true }, // Destination name for listing
  destination_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', required: false },
  duration_days: { type: Number, required: true }, // Duration for display
  budget_total: { type: Number, required: true }, // Budget for display
  participant_number: { type: Number, required: true }, // Travelers count
  preferences: [{ type: String }], // User preferences
  tour_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour' },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider' },
  itinerary_data: { type: Object }, // full generated structure
  summary: { type: String },
  status: { type: String, enum: ['done', 'failed', 'custom'], default: 'done' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

aiGeneratedItinerarySchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

aiGeneratedItinerarySchema.set('toJSON', { virtuals: true });
aiGeneratedItinerarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AiGeneratedItinerary', aiGeneratedItinerarySchema, 'AI_GENERATED_ITINERARIES');
