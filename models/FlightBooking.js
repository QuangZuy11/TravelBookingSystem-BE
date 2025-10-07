const mongoose = require('mongoose');

const flightBookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlightSchedule', required: true },
  seatId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlightSeat', required: true },
  bookingDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['booked', 'cancelled', 'completed'], default: 'booked' },
  totalPrice: { type: Number, required: true },
  passengers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BookingPassenger' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FlightBooking', flightBookingSchema);
