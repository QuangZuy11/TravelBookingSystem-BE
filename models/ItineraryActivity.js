const mongoose = require('mongoose');

const itineraryActivitySchema = new mongoose.Schema({
    itineraryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Itinerary',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['sightseeing', 'meal', 'transportation', 'accommodation', 'free_time', 'other'],
        required: true
    },
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Destination'
    },
    duration: {
        hours: Number,
        minutes: Number
    },
    startTime: Date,
    endTime: Date,
    dayNumber: {
        type: Number,
        required: true
    },
    order: {
        type: Number,
        required: true
    },
    includedServices: [{
        type: String
    }],
    additionalNotes: String,
    images: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['planned', 'in_progress', 'completed', 'cancelled'],
        default: 'planned'
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

module.exports = mongoose.model('ItineraryActivity', itineraryActivitySchema);