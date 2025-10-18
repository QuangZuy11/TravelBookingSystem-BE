const mongoose = require('mongoose');

const aiGeneratedItinerarySchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AiItineraryRequest', required: true },
  destination_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', required: false },
  tour_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour' },
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider' },
  itinerary_data: { type: Object }, // full generated structure
  summary: { type: String },
  status: { type: String, enum: ['done', 'failed'], default: 'done' },
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
