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
  gender: {
    type: String,
    enum: ['Nam', 'Nữ', 'Khác'],
    default: 'Khác',
  },
  date_of_birth: {
    type: Date,
  },
  city: {
    type: String,
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);