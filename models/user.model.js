const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  // Support both 'role' and 'role_id' for backward compatibility
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
  },
  role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
  },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active',
  },
  ban_reason: { type: String },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook to sync role and role_id
userSchema.pre('save', function(next) {
  if (this.role && !this.role_id) {
    this.role_id = this.role;
  } else if (this.role_id && !this.role) {
    this.role = this.role_id;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);