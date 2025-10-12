const mongoose = require('mongoose');

const flightSeatSchema = new mongoose.Schema({
  flight_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Flight', 
    required: true 
  },
  class_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'FlightClass', 
    required: true 
  },
  seat_number: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['available', 'booked', 'blocked'], 
    default: 'available' 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

// Unique constraint: một flight không thể có 2 ghế cùng số
flightSeatSchema.index({ flight_id: 1, seat_number: 1 }, { unique: true });

module.exports = mongoose.model('FlightSeat', flightSeatSchema);
