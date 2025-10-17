const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    serviceType: {
        type: String,
        enum: ['tour', 'hotel'],
        required: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'serviceType',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: true
    },
    comment: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    likes: {
        type: Number,
        default: 0
    },
    response: {
        comment: String,
        date: Date,
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    verifiedBooking: {
        type: Boolean,
        default: false
    },
    categories: [{
        name: String,
        rating: Number
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

module.exports = mongoose.model('Review', reviewSchema, 'REVIEWS');