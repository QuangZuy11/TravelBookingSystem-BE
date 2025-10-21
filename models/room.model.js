const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    hotelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    roomNumber: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['single', 'double', 'twin', 'suite', 'deluxe', 'family']
    },
    capacity: {
        type: Number,
        required: true
    },
    pricePerNight: {
        type: Number,
        required: true
    },
    amenities: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['available', 'occupied', 'maintenance', 'reserved'],
        default: 'available'
    },
    floor: {
        type: Number,
        required: true
    },
    images: [{
        type: String
    }],
    description: {
        type: String
    },
    area: {
        type: Number, // in square meters
        required: true
    },
    bookings: [{
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HotelBooking'
        },
        checkIn: Date,
        checkOut: Date
    }],
    lastCleaned: {
        type: Date,
        default: Date.now
    },
    maintenanceHistory: [{
        date: Date,
        description: String,
        cost: Number
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

// Middleware to update hotel's room count
roomSchema.post('save', async function(doc) {
    const Hotel = mongoose.model('Hotel');
    await Hotel.findByIdAndUpdate(doc.hotelId, {
        $inc: { totalRooms: 1 }
    });
});

roomSchema.post('remove', async function(doc) {
    const Hotel = mongoose.model('Hotel');
    await Hotel.findByIdAndUpdate(doc.hotelId, {
        $inc: { totalRooms: -1 }
    });
});

module.exports = mongoose.model('Room', roomSchema, 'HOTEL_ROOMS');