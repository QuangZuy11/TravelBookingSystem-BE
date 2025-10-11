const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    businessType: [{
        type: String,
        enum: ['tour', 'hotel', 'flight'],
        required: true
    }],
    description: String,
    contactInfo: {
        email: String,
        phone: String,
        address: String,
        website: String
    },
    licenseNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'suspended'],
        default: 'pending'
    },
    verificationStatus: {
        type: String,
        enum: ['verified', 'unverified'],
        default: 'unverified'
    },
    documents: [{
        type: String, // URLs to business documents
        required: true
    }],
    rating: {
        type: Number,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    serviceProcesses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProcess'
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

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);