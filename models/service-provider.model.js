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
    // NOTE: Chỉ hotel có thể có nhiều licenses, tour chỉ có 1 license duy nhất
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

// Pre-save validation: Hotel có thể nhiều licenses, tour chỉ 1
serviceProviderSchema.pre('save', function(next) {
    const hotelLicenses = this.licenses.filter(l => l.service_type === 'hotel');
    const tourLicenses = this.licenses.filter(l => l.service_type === 'tour');
    
    // Tour chỉ được có 1 license
    if (tourLicenses.length > 1) {
        return next(new Error('Tour provider chỉ có thể có 1 license duy nhất'));
    }
    
    // Check duplicate license_number trong cùng 1 provider
    const licenseNumbers = this.licenses.map(l => l.license_number);
    const uniqueLicenseNumbers = [...new Set(licenseNumbers)];
    if (licenseNumbers.length !== uniqueLicenseNumbers.length) {
        return next(new Error('License number không được trùng lặp'));
    }
    
    next();
});

// Validation: Type phải match với licenses
serviceProviderSchema.pre('save', function(next) {
    const typesInLicenses = [...new Set(this.licenses.map(l => l.service_type))];
    const typesInType = this.type;
    
    // Mọi type trong licenses phải có trong type array
    const missingTypes = typesInLicenses.filter(t => !typesInType.includes(t));
    if (missingTypes.length > 0) {
        return next(new Error(`Service types trong licenses không khớp với type: ${missingTypes.join(', ')}`));
    }
    
    next();
});

// Virtual để check xem provider đã được verify chưa (TẤT CẢ licenses verified)
serviceProviderSchema.virtual('is_verified').get(function() {
    return this.licenses.every(license => license.verification_status === 'verified');
});

// Virtual để check xem đã được admin phê duyệt toàn bộ chưa (license verified + admin approved)
serviceProviderSchema.virtual('is_fully_approved').get(function() {
    return this.admin_verified && this.is_verified;
});

// Virtual để check xem có license nào đang pending không
serviceProviderSchema.virtual('has_pending_verification').get(function() {
    return this.licenses.some(license => license.verification_status === 'pending');
});

// Method để lấy license theo service type
serviceProviderSchema.methods.getLicenseByType = function(serviceType) {
    return this.licenses.find(license => license.service_type === serviceType);
};

// Method để update verification status
serviceProviderSchema.methods.updateVerificationStatus = function(serviceType, status, verifiedBy, rejectionReason = null) {
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
serviceProviderSchema.methods.updateAdminVerification = function(approved, adminId, rejectionReason = null) {
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

// Set toJSON options
serviceProviderSchema.set('toJSON', { virtuals: true });
serviceProviderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema, 'SERVICE_PROVIDERS');