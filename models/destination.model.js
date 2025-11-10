const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
    destination_name: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    coordinates: {
        latitude: Number,
        longitude: Number
    },
    popular_seasons: [String],
    weather_info: {
        temperature_range: {
            min: Number,
            max: Number
        },
        rainfall: String,
        humidity: String
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Destination', destinationSchema, 'DESTINATIONS');