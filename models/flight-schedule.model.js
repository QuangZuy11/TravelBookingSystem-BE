const mongoose = require('mongoose');

const flightScheduleSchema = new mongoose.Schema({
  flight_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Flight', 
    required: true 
  },
  departure_date: { 
    type: Date, 
    required: true 
  },
  departure_time: { 
    type: String, 
    required: true 
  },
  arrival_date: { 
    type: Date, 
    required: true 
  },
  arrival_time: { 
    type: String, 
    required: true 
  },
  actual_departure: { 
    type: Date
  },
  actual_arrival: { 
    type: Date
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'delayed', 'cancelled', 'completed'], 
    default: 'scheduled' 
  },
  delay_reason: { 
    type: String
  },
  gate_number: { 
    type: String
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('FlightSchedule', flightScheduleSchema);
