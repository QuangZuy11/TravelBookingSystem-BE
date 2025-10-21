const mongoose = require('mongoose');

const pointOfInterestSchema = new mongoose.Schema({
    destinationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Destination',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['historical', 'natural', 'cultural', 'religious', 'entertainment', 'shopping', 'dining', 'other'],
        required: true
    },
    location: {
        address: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    images: [{
        type: String
    }],
    openingHours: {
        monday: { open: String, close: String },
        tuesday: { open: String, close: String },
        wednesday: { open: String, close: String },
        thursday: { open: String, close: String },
        friday: { open: String, close: String },
        saturday: { open: String, close: String },
        sunday: { open: String, close: String }
    },
    entryFee: {
        adult: Number,
        child: Number,
        senior: Number,
        currency: String
    },
    recommendedDuration: {
        hours: Number,
        minutes: Number
    },
    facilities: [String],
    accessibility: {
        wheelchair: Boolean,
        publicTransport: Boolean,
        parking: Boolean
    },
    ratings: {
        average: {
            type: Number,
            default: 0
        },
        count: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'temporarily_closed'],
        default: 'active'
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

module.exports = mongoose.model('PointOfInterest', pointOfInterestSchema, 'POINTS_OF_INTEREST');