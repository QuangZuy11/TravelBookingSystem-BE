const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    bookingType: {
        type: String,
        enum: ['tour', 'hotel'],
        required: true
    },
    // Dynamic reference based on bookingType
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'bookingType',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    bookingDate: {
        type: Date,
        default: Date.now
    },
    checkInDate: {
        type: Date,
        required: true
    },
    checkOutDate: {
        type: Date,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed'],
        default: 'pending'
    },
    numberOfGuests: {
        adults: {
            type: Number,
            required: true
        },
        children: {
            type: Number,
            default: 0
        }
    },
    specialRequests: String,
    cancellationReason: String,
    cancellationDate: Date,
    refundAmount: Number,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Booking', bookingSchema, 'HOTEL_BOOKINGS');