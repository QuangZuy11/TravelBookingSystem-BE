const mongoose = require('mongoose');

const aiItineraryRequestSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destination: { type: String, required: true },
  start_date: { type: Date },
  end_date: { type: Date },
  duration_days: { type: Number },
  participant_number: { type: Number, default: 1 },
  age_range: { type: Array, default: [] },
  budget_level: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  preferences: { type: Array, default: [] },
  status: { type: String, enum: ['pending','processing','completed','failed'], default: 'pending' },
  ai_response: { type: Object },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

aiItineraryRequestSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

aiItineraryRequestSchema.set('toJSON', { virtuals: true });
aiItineraryRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AiItineraryRequest', aiItineraryRequestSchema);
