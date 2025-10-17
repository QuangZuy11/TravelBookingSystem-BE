const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    location: {
        address: String,
        city: String,
        country: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    type: {
        type: String,
        enum: ['city', 'landmark', 'nature', 'cultural', 'entertainment', 'other'],
        required: true
    },
    images: [{
        type: String
    }],
    pointsOfInterest: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PointOfInterest'
    }],
    bestTimeToVisit: {
        start: Date,
        end: Date
    },
    weatherInfo: {
        climate: String,
        seasonality: String
    },
    localCurrency: String,
    languages: [String],
    timeZone: String,
    visaRequirements: String,
    travelTips: [String],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Destination', destinationSchema, 'DESTINATIONS');