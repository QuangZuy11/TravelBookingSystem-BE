const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    serviceType: {
        type: String,
        enum: ['tour', 'flight'],
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
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    slots: {
        total: {
            type: Number,
            required: true
        },
        booked: {
            type: Number,
            default: 0
        },
        available: {
            type: Number,
            required: true
        }
    },
    price: {
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'USD'
        }
    },
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    bookings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    }],
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Schedule', scheduleSchema);