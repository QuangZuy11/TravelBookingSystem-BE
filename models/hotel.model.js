const mongoose = require('mongoose');
const { STANDARD_AMENITIES } = require('../constants/amenities.constants');

const hotelSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    destination_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Destination',
        required: false // Optional: hotel may not belong to any destination
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
        type: String,
        enum: STANDARD_AMENITIES,
        trim: true
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
    promotions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Promotion'
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

// Virtual: Tính toán số phòng từ Room collection
hotelSchema.virtual('totalRooms', {
    ref: 'Room',
    localField: '_id',
    foreignField: 'hotelId',
    count: true
});

// Virtual: Tính toán số phòng available từ Room collection  
hotelSchema.virtual('availableRooms', {
    ref: 'Room',
    localField: '_id',
    foreignField: 'hotelId',
    count: true,
    match: { status: 'available' }
});

// Method: Lấy thống kê phòng realtime
hotelSchema.methods.getRoomStats = async function () {
    const Room = mongoose.model('Room');

    const stats = await Room.aggregate([
        { $match: { hotelId: this._id } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        total: 0,
        available: 0,
        occupied: 0,
        maintenance: 0,
        reserved: 0
    };

    stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
    });

    return result;
};

// Enable virtuals in JSON
hotelSchema.set('toJSON', { virtuals: true });
hotelSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Hotel', hotelSchema, 'HOTELS');
