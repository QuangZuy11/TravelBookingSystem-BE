const mongoose = require('mongoose');

const serviceProcessSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    serviceType: {
        type: String,
        enum: ['tour', 'hotel', 'flight'],
        required: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'serviceType',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled'],
        default: 'pending'
    },
    steps: [{
        step: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        completedAt: Date,
        notes: String
    }],
    startDate: {
        type: Date,
        required: true
    },
    endDate: Date,
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

module.exports = mongoose.model('ServiceProcess', serviceProcessSchema);