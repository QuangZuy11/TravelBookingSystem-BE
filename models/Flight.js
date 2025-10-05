const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    flightNumber: {
        type: String,
        required: true,
        unique: true
    },
    airline: {
        name: String,
        code: String,
        logo: String
    },
    departure: {
        airport: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        terminal: String,
        date: {
            type: Date,
            required: true
        },
        time: {
            type: String,
            required: true
        }
    },
    arrival: {
        airport: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        terminal: String,
        date: {
            type: Date,
            required: true
        },
        time: {
            type: String,
            required: true
        }
    },
    duration: {
        type: String,
        required: true
    },
    aircraft: {
        type: String,
        required: true
    },
    capacity: {
        economy: {
            total: Number,
            available: Number,
            price: Number
        },
        business: {
            total: Number,
            available: Number,
            price: Number
        },
        firstClass: {
            total: Number,
            available: Number,
            price: Number
        }
    },
    status: {
        type: String,
        enum: ['scheduled', 'delayed', 'cancelled', 'completed'],
        default: 'scheduled'
    },
    amenities: [{
        type: String
    }],
    baggageAllowance: {
        carryOn: {
            weight: Number,
            unit: String
        },
        checked: {
            weight: Number,
            unit: String
        }
    },
    mealOptions: [{
        type: String
    }],
    bookings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    }],
    reviews: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rating: Number,
        comment: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Flight', flightSchema);