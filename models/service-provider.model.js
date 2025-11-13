const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    company_name: {
        type: String,
        required: true,
        trim: true
    },
    contact_person: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    // Loại hình dịch vụ - CHỈ được chọn 1 loại
    type: {
        type: String,
        enum: ['hotel', 'tour'],
        required: true
    },
    // Mảng chứa license và verification status cho từng loại dịch vụ  
    // NOTE: Mỗi provider chỉ có thể có 1 license duy nhất (hotel hoặc tour)
    licenses: [{
        service_type: {
            type: String,
            enum: ['hotel', 'tour'],
            required: true
        },
        license_number: {
            type: String,
            required: true,
            trim: true
            // NOTE: Unique constraint được định nghĩa ở index bên dưới
        },
        verification_status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending'
        },
        verified_at: Date,
        verified_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rejection_reason: String,
        documents: [{
            type: String // URLs to license documents
        }]
    }],
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    total_reviews: {
        type: Number,
        default: 0,
        min: 0
    },
    // Admin verification - phê duyệt toàn bộ provider (độc lập với licenses)
    admin_verified: {
        type: Boolean,
        default: false
    },
    admin_verified_at: {
        type: Date
    },
    admin_verified_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    admin_rejection_reason: {
        type: String
    },

    // ✅ Booking management settings
    booking_settings: {
        auto_accept_bookings: { type: Boolean, default: false },
        max_concurrent_bookings: { type: Number, default: 10 },
        minimum_notice_days: { type: Number, default: 7 },
        response_time_hours: { type: Number, default: 48 },
        available_destinations: [{ type: String }],
        blackout_dates: [{ type: Date }]
    },

    // ✅ Booking statistics
    booking_stats: {
        total_bookings: { type: Number, default: 0 },
        approved_bookings: { type: Number, default: 0 },
        rejected_bookings: { type: Number, default: 0 },
        completed_bookings: { type: Number, default: 0 },
        approval_rate: { type: Number, default: 0, min: 0, max: 100 },
        average_response_time: { type: Number, default: 0 },
        total_revenue: { type: Number, default: 0 }
    },

    // ✅ Pricing strategy
    pricing_settings: {
        markup_percentage: { type: Number, default: 15, min: 0, max: 100 },
        seasonal_pricing: [{
            season: { type: String, enum: ['peak', 'off-peak', 'shoulder'] },
            start_date: { type: Date },
            end_date: { type: Date },
            adjustment_percentage: { type: Number }
        }],
        group_discounts: [{
            min_participants: { type: Number },
            discount_percentage: { type: Number, min: 0, max: 100 }
        }]
    },

    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Indexes
serviceProviderSchema.index({ user_id: 1 });
serviceProviderSchema.index({ company_name: 1 });
serviceProviderSchema.index({ type: 1 });
serviceProviderSchema.index({ 'licenses.verification_status': 1 });
serviceProviderSchema.index({ 'licenses.license_number': 1 }, { unique: true, sparse: true }); // Unique constraint

// Pre-save validation: Mỗi provider chỉ được có 1 license duy nhất
serviceProviderSchema.pre('save', function (next) {
    if (!this.licenses || !Array.isArray(this.licenses)) {
        return next();
    }

    // Chỉ được có 1 license duy nhất
    if (this.licenses.length > 1) {
        return next(new Error('Mỗi provider chỉ có thể có 1 giấy đăng ký kinh doanh duy nhất'));
    }

    // License type phải khớp với provider type
    if (this.licenses.length === 1 && this.licenses[0].service_type !== this.type) {
        return next(new Error('Loại giấy phép phải khớp với loại dịch vụ của provider'));
    }

    next();
});



// Virtual để check xem provider đã được verify chưa (TẤT CẢ licenses verified)
serviceProviderSchema.virtual('is_verified').get(function () {
    if (!this.licenses || this.licenses.length === 0) {
        return false;
    }
    return this.licenses.every(license => license.verification_status === 'verified');
});

// Virtual để check xem đã được admin phê duyệt toàn bộ chưa (license verified + admin approved)
serviceProviderSchema.virtual('is_fully_approved').get(function () {
    return this.admin_verified && this.is_verified;
});

// Virtual để check xem có license nào đang pending không
serviceProviderSchema.virtual('has_pending_verification').get(function () {
    return this.licenses && this.licenses.some(license => license.verification_status === 'pending');
});

// Method để lấy license theo service type
serviceProviderSchema.methods.getLicenseByType = function (serviceType) {
    if (!this.licenses || !Array.isArray(this.licenses)) {
        return null;
    }
    return this.licenses.find(license => license.service_type === serviceType);
};

// Method để update verification status
serviceProviderSchema.methods.updateVerificationStatus = function (serviceType, status, verifiedBy, rejectionReason = null) {
    if (!this.licenses || !Array.isArray(this.licenses)) {
        return false;
    }
    const license = this.licenses.find(l => l.service_type === serviceType);
    if (license) {
        license.verification_status = status;
        if (status === 'verified') {
            license.verified_at = new Date();
            license.verified_by = verifiedBy;
        } else if (status === 'rejected') {
            license.rejection_reason = rejectionReason;
        }
    }
    return this.save();
};

// Method để admin phê duyệt/từ chối toàn bộ provider
serviceProviderSchema.methods.updateAdminVerification = function (approved, adminId, rejectionReason = null) {
    this.admin_verified = approved;
    if (approved) {
        this.admin_verified_at = new Date();
        this.admin_verified_by = adminId;
        this.admin_rejection_reason = null;
    } else {
        this.admin_verified_at = null;
        this.admin_verified_by = null;
        this.admin_rejection_reason = rejectionReason;
    }
    return this.save();
};

// ✅ Method để calculate quote
serviceProviderSchema.methods.calculateQuote = function (booking) {
    let basePrice = booking.total_budget || 0;

    // Apply markup percentage
    let markup = basePrice * (this.pricing_settings.markup_percentage / 100);
    let quotedPrice = basePrice + markup;

    // Apply seasonal pricing if applicable
    if (this.pricing_settings.seasonal_pricing && this.pricing_settings.seasonal_pricing.length > 0) {
        const bookingDate = new Date(booking.start_date);
        const seasonalRate = this.pricing_settings.seasonal_pricing.find(season => {
            return bookingDate >= new Date(season.start_date) && bookingDate <= new Date(season.end_date);
        });

        if (seasonalRate) {
            quotedPrice += quotedPrice * (seasonalRate.adjustment_percentage / 100);
        }
    }

    // Apply group discounts if applicable
    if (this.pricing_settings.group_discounts && this.pricing_settings.group_discounts.length > 0) {
        const applicableDiscount = this.pricing_settings.group_discounts
            .filter(discount => booking.participant_number >= discount.min_participants)
            .sort((a, b) => b.discount_percentage - a.discount_percentage)[0];

        if (applicableDiscount) {
            quotedPrice -= quotedPrice * (applicableDiscount.discount_percentage / 100);
        }
    }

    return Math.round(quotedPrice);
};

// ✅ Method để update booking statistics
serviceProviderSchema.methods.updateBookingStats = function (action, amount = 0) {
    switch (action) {
        case 'approved':
            this.booking_stats.approved_bookings += 1;
            this.booking_stats.total_bookings += 1;
            break;
        case 'rejected':
            this.booking_stats.rejected_bookings += 1;
            this.booking_stats.total_bookings += 1;
            break;
        case 'completed':
            this.booking_stats.completed_bookings += 1;
            this.booking_stats.total_revenue += amount;
            break;
    }

    // Calculate approval rate
    if (this.booking_stats.total_bookings > 0) {
        this.booking_stats.approval_rate =
            (this.booking_stats.approved_bookings / this.booking_stats.total_bookings) * 100;
    }

    return this.save();
};

// Set toJSON options
serviceProviderSchema.set('toJSON', { virtuals: true });
serviceProviderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema, 'SERVICE_PROVIDERS');