const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    category: {
        type: String,
        enum: ['1_star', '2_star', '3_star', '4_star', '5_star'],
        required: true
    },
    amenities: [{
        type: String
    }],
    images: [{
        type: String,
        required: true
    }],
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    totalRooms: {
        type: Number,
        required: true,
        min: 0
    },
    availableRooms: {
        type: Number,
        required: true,
        min: 0
    },
    priceRange: {
        min: Number,
        max: Number
    },
    policies: {
        checkInTime: String,
        checkOutTime: String,
        cancellationPolicy: String,
        petsAllowed: Boolean,
        paymentOptions: [String]
    },
    contactInfo: {
        phone: String,
        email: String,
        website: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
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
    bookingsCount: {
        type: Number,
        default: 0
    },
    revenue: {
        type: Number,
        default: 0
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

module.exports = mongoose.model('Hotel', hotelSchema);