const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
    service_provider_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    flight_number: {
        type: String,
        required: true,
        unique: true
    },
    airline_code: {
        type: String,
        required: true
    },
    airline_name: {
        type: String,
        required: true
    },
    aircraft_type: {
        type: String,
        required: true
    },
    departure_airport: {
        type: String,
        required: true
    },
    arrival_airport: {
        type: String,
        required: true
    },
    departure_terminal: {
        type: String
    },
    arrival_terminal: {
        type: String
    },
    departure_time: {
        type: Date,
        required: true
    },
    arrival_time: {
        type: Date,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    flight_type: {
        type: String,
        enum: ['domestic', 'international'],
        required: true
    },
    days_of_week: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    baggage_policy: {
        cabin: {
            weight: Number,
            dimensions: String
        },
        checked: {
            weight: Number,
            dimensions: String,
            pieces: Number
        }
    },
    meal_service: {
        type: Boolean,
        default: false
    },
    wifi_available: {
        type: Boolean,
        default: false
    },
    entertainment_system: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['scheduled', 'delayed', 'cancelled', 'completed'],
        default: 'scheduled'
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

module.exports = mongoose.model('Flight', flightSchema);
