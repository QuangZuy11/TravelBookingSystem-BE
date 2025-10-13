const mongoose = require('mongoose');

const bookingPassengerSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlightBooking', required: true },
  fullName: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  dateOfBirth: { type: Date, required: true },
  nationality: { type: String, required: true },
  passportNumber: { type: String },
  seatNumber: { type: String },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'FlightClass' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BookingPassenger', bookingPassengerSchema);
