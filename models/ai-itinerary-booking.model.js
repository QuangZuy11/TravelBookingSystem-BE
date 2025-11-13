const mongoose = require('mongoose');

const aiItineraryBookingSchema = new mongoose.Schema({
    // Reference IDs
    ai_itinerary_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AiGeneratedItinerary',
        required: true,
        index: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    provider_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        default: null,
        index: true
    },

    // Trip Details
    destination: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    duration_days: {
        type: Number,
        required: true,
        min: 1,
        max: 30
    },
    participant_number: {
        type: Number,
        required: true,
        min: 1,
        max: 50
    },
    start_date: {
        type: Date,
        required: true,
        index: true,
        validate: {
            validator: function (value) {
                // Start date must be in the future
                return value > new Date();
            },
            message: 'Start date must be in the future'
        }
    },

    // Budget & Pricing
    total_budget: {
        type: Number,
        required: true,
        min: 0
    },
    quoted_price: {
        type: Number,
        default: null,
        min: 0
    },

    // Selected Activities
    selected_activities: [{
        day_number: {
            type: Number,
            required: true,
            min: 1
        },
        activity_name: {
            type: String,
            required: true,
            trim: true
        },
        activity_type: {
            type: String,
            required: true,
            enum: ['culture', 'nature', 'adventure', 'food', 'shopping', 'relaxation', 'entertainment', 'other'],
            default: 'other'  // ✅ Add default value
        },
        location: {
            type: String,
            required: false,  // ✅ Make it optional since controller will handle it
            trim: true,
            default: ''
        },
        cost: {
            type: Number,
            default: 0,
            min: 0
        },
        duration: {
            type: String,
            default: null
        },
        description: {
            type: String,
            default: null
        }
    }],

    // Contact Information
    contact_info: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            match: [/^[0-9]{10,11}$/, 'Please provide a valid phone number (10-11 digits)']
        }
    },

    // Special Requests & Notes
    special_requests: {
        type: String,
        default: null,
        maxlength: 1000
    },
    provider_notes: {
        type: String,
        default: null,
        maxlength: 1000
    },

    // Services Included/Excluded
    included_services: [{
        type: String,
        trim: true
    }],
    excluded_services: [{
        type: String,
        trim: true
    }],

    // Status & Workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'confirmed', 'completed', 'rejected', 'cancelled'],
        default: 'pending',
        index: true
    },

    // Timestamps for Status Changes
    approved_at: {
        type: Date,
        default: null
    },
    confirmed_at: {
        type: Date,
        default: null
    },
    completed_at: {
        type: Date,
        default: null
    },
    rejected_at: {
        type: Date,
        default: null
    },
    cancelled_at: {
        type: Date,
        default: null
    },

    // Rejection/Cancellation Reasons
    rejection_reason: {
        type: String,
        default: null,
        maxlength: 500
    },
    cancellation_reason: {
        type: String,
        default: null,
        maxlength: 500
    },

    // Completion Details
    completion_notes: {
        type: String,
        default: null,
        maxlength: 500
    },

    // Admin Actions
    admin_action_history: [{
        action: {
            type: String,
            enum: ['approve', 'reject', 'refund', 'resolve'],
            required: true
        },
        admin_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        admin_notes: {
            type: String,
            maxlength: 1000
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],

    // Payment Information (optional, for future integration)
    payment_status: {
        type: String,
        enum: ['unpaid', 'partially_paid', 'paid', 'refunded'],
        default: 'unpaid'
    },
    payment_amount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Metadata
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound Indexes for Performance
aiItineraryBookingSchema.index({ user_id: 1, status: 1, created_at: -1 });
aiItineraryBookingSchema.index({ provider_id: 1, status: 1, start_date: 1 });
aiItineraryBookingSchema.index({ status: 1, created_at: -1 });

// Text Search Index
aiItineraryBookingSchema.index({
    'contact_info.name': 'text',
    'contact_info.email': 'text',
    destination: 'text'
});

// Virtual to populate provider info
aiItineraryBookingSchema.virtual('provider_info', {
    ref: 'ServiceProvider',
    localField: 'provider_id',
    foreignField: '_id',
    justOne: true
});

// Virtual to populate user info
aiItineraryBookingSchema.virtual('user_info', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
});

// Virtual to populate itinerary info
aiItineraryBookingSchema.virtual('itinerary_info', {
    ref: 'AiGeneratedItinerary',
    localField: 'ai_itinerary_id',
    foreignField: '_id',
    justOne: true
});

// Pre-save middleware to update timestamp
aiItineraryBookingSchema.pre('save', function (next) {
    this.updated_at = Date.now();
    next();
});

// Method to check if booking can be cancelled
aiItineraryBookingSchema.methods.canBeCancelled = function () {
    return this.status === 'pending' || this.status === 'approved';
};

// Method to check if booking can be approved
aiItineraryBookingSchema.methods.canBeApproved = function () {
    return this.status === 'pending';
};

// Method to check if booking can be rejected
aiItineraryBookingSchema.methods.canBeRejected = function () {
    return this.status === 'pending';
};

// Method to check if booking can be completed
aiItineraryBookingSchema.methods.canBeCompleted = function () {
    // ✅ Allow completion from both 'approved' and 'confirmed' status
    // 'approved': Provider can complete without payment confirmation
    // 'confirmed': Standard flow after payment
    return this.status === 'confirmed' || this.status === 'approved';
};

// Method to approve booking
aiItineraryBookingSchema.methods.approveBooking = function (quotedPrice, providerNotes, includedServices, excludedServices) {
    if (!this.canBeApproved()) {
        throw new Error('Booking cannot be approved in current status');
    }
    this.status = 'approved';
    this.quoted_price = quotedPrice;
    this.provider_notes = providerNotes;
    this.included_services = includedServices;
    this.excluded_services = excludedServices || [];
    this.approved_at = new Date();
    return this.save();
};

// Method to reject booking
aiItineraryBookingSchema.methods.rejectBooking = function (reason) {
    if (!this.canBeRejected()) {
        throw new Error('Booking cannot be rejected in current status');
    }
    this.status = 'rejected';
    this.rejection_reason = reason;
    this.rejected_at = new Date();
    return this.save();
};

// Method to cancel booking
aiItineraryBookingSchema.methods.cancelBooking = function (reason) {
    if (!this.canBeCancelled()) {
        throw new Error('Booking cannot be cancelled in current status');
    }
    this.status = 'cancelled';
    this.cancellation_reason = reason;
    this.cancelled_at = new Date();
    return this.save();
};

// Method to confirm booking (after payment)
aiItineraryBookingSchema.methods.confirmBooking = function () {
    if (this.status !== 'approved') {
        throw new Error('Only approved bookings can be confirmed');
    }
    this.status = 'confirmed';
    this.confirmed_at = new Date();
    return this.save();
};

// Method to complete booking
aiItineraryBookingSchema.methods.completeBooking = function (completionNotes) {
    if (!this.canBeCompleted()) {
        throw new Error('Booking cannot be completed in current status. Must be approved or confirmed.');
    }

    // ✅ Auto-confirm if coming from 'approved' status
    if (this.status === 'approved' && !this.confirmed_at) {
        this.confirmed_at = new Date();
    }

    this.status = 'completed';
    this.completion_notes = completionNotes;
    this.completed_at = new Date();
    return this.save();
};

// Method to add admin action
aiItineraryBookingSchema.methods.addAdminAction = function (action, adminId, adminNotes) {
    this.admin_action_history.push({
        action,
        admin_id: adminId,
        admin_notes: adminNotes,
        timestamp: new Date()
    });
    return this.save();
};

// Static method to get booking statistics
aiItineraryBookingSchema.statics.getStatistics = async function (filters = {}) {
    const matchStage = {};

    if (filters.start_date || filters.end_date) {
        matchStage.created_at = {};
        if (filters.start_date) matchStage.created_at.$gte = new Date(filters.start_date);
        if (filters.end_date) matchStage.created_at.$lte = new Date(filters.end_date);
    }

    if (filters.provider_id) {
        matchStage.provider_id = mongoose.Types.ObjectId(filters.provider_id);
    }

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $facet: {
                statusCounts: [
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ],
                totalRevenue: [
                    {
                        $match: { status: 'completed', quoted_price: { $exists: true } }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$quoted_price' }
                        }
                    }
                ],
                averageValue: [
                    {
                        $match: { quoted_price: { $exists: true, $gt: 0 } }
                    },
                    {
                        $group: {
                            _id: null,
                            average: { $avg: '$quoted_price' }
                        }
                    }
                ],
                byDestination: [
                    {
                        $group: {
                            _id: '$destination',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]
            }
        }
    ]);

    return stats[0];
};

module.exports = mongoose.model('AiItineraryBooking', aiItineraryBookingSchema, 'AI_ITINERARY_BOOKINGS');
