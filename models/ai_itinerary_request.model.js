const mongoose = require('mongoose');

const aiItineraryRequestSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Destination is now OPTIONAL (user may not know where to go)
  destination: { type: String, required: false },
  // Trip details
  start_date: { type: Date },
  end_date: { type: Date },
  duration_days: { type: Number },
  participant_number: { type: Number, default: 1 },
  age_range: { type: Array, default: [] }, // e.g. ['28-35']
  budget_total: { type: Number }, // Total budget in VND (e.g. 10000000)
  budget_level: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  // Preferences (e.g. ['nature', 'food', 'culture', 'adventure'])
  preferences: { type: Array, default: [] },

  // AI suggested destination (when user doesn't provide destination)
  ai_suggested_destination: { type: String },

  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  ai_response: { type: Object },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

aiItineraryRequestSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

aiItineraryRequestSchema.set('toJSON', { virtuals: true });
aiItineraryRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AiItineraryRequest', aiItineraryRequestSchema, 'AI_ITINERARY_REQUESTS');
