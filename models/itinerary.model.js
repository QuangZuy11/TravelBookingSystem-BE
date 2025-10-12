const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema({
    tour_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tour',
        required: true
    },
    provider_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: false  // Optional for now (no auth)
    },
    day_number: {
        type: Number,
        required: true,
        min: 1
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    meals: [{
        type: String,
        enum: ['breakfast', 'lunch', 'dinner', 'snack']
    }],
    accommodation: {
        name: String,
        type: {
            type: String,
            enum: ['hotel', 'resort', 'homestay', 'camping', 'guesthouse', 'other']
        },
        address: String,
        check_in: String,
        check_out: String,
        rating: Number
    },
    transportation: {
        type: {
            type: String,
            enum: ['flight', 'bus', 'train', 'car', 'boat', 'walking', 'other']
        },
        details: String,
        departure_time: String,
        arrival_time: String,
        departure_location: String,
        arrival_location: String
    },
    activities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItineraryActivity'
    }],
    notes: String,
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Indexes
itinerarySchema.index({ tour_id: 1, day_number: 1 }, { unique: true }); // Unique day per tour
itinerarySchema.index({ provider_id: 1 });

// Update timestamp on save
itinerarySchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

// Ensure virtuals are included
itinerarySchema.set('toJSON', { virtuals: true });
itinerarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Itinerary', itinerarySchema);