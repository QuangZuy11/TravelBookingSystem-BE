const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema({
    tourId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tour',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    duration: {
        days: Number,
        nights: Number,
        required: true
    },
    activities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItineraryActivity'
    }],
    destinations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Destination'
    }],
    includedServices: [{
        type: String,
        enum: ['transportation', 'accommodation', 'meals', 'guide', 'entrance_fees', 'insurance']
    }],
    schedule: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule'
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Itinerary', itinerarySchema);