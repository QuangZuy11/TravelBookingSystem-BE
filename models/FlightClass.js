const mongoose = require('mongoose');

const flightClassSchema = new mongoose.Schema({
  flight_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Flight', 
    required: true 
  },
  class_type: { 
    type: String, 
    enum: ['Economy', 'Business', 'First'], 
    required: true 
  },
  class_name: { 
    type: String, 
    required: true 
  },
  total_seats: { 
    type: Number, 
    required: true,
    min: 0
  },
  available_seats: { 
    type: Number, 
    required: true,
    min: 0
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  baggage_allowance: {
    cabin: {
      weight: Number,
      unit: String
    },
    checked: {
      weight: Number,
      unit: String,
      pieces: Number
    }
  },
  seat_pitch: { 
    type: String
  },
  seat_width: { 
    type: String
  },
  amenities: [{
    type: String
  }],
  refund_policy: { 
    type: String
  },
  change_policy: { 
    type: String
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for better query performance
flightClassSchema.index({ flight_id: 1, class_type: 1 }); // Composite index for querying classes by flight and type
flightClassSchema.index({ flight_id: 1 }); // For querying all classes of a flight

module.exports = mongoose.model('FlightClass', flightClassSchema);
