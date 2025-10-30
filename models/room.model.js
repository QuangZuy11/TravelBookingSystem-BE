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
    // xem xét bỏ
    lastCleaned: {
        type: Date,
        default: Date.now
    },
    //xem xét bỏ 
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
roomSchema.post('save', async function (doc) {
    const Hotel = mongoose.model('Hotel');

    // Nếu là room mới, tăng totalRooms
    if (this.isNew) {
        await Hotel.findByIdAndUpdate(doc.hotelId, {
            $inc: { totalRooms: 1 }
        });
    }

    // Update availableRooms dựa trên status
    await updateHotelAvailableRooms(doc.hotelId);
});

roomSchema.post('remove', async function (doc) {
    const Hotel = mongoose.model('Hotel');
    await Hotel.findByIdAndUpdate(doc.hotelId, {
        $inc: { totalRooms: -1 }
    });

    // Update availableRooms sau khi xóa room
    await updateHotelAvailableRooms(doc.hotelId);
});

// Middleware: Update availableRooms khi status thay đổi
roomSchema.post('findOneAndUpdate', async function (doc) {
    if (doc) {
        await updateHotelAvailableRooms(doc.hotelId);
    }
});

// Helper function để update availableRooms của Hotel
async function updateHotelAvailableRooms(hotelId) {
    const Room = mongoose.model('Room');
    const Hotel = mongoose.model('Hotel');

    // Đếm số phòng có status = 'available'
    const availableCount = await Room.countDocuments({
        hotelId: hotelId,
        status: 'available'
    });

    // Update availableRooms
    await Hotel.findByIdAndUpdate(hotelId, {
        availableRooms: availableCount
    });
}

module.exports = mongoose.model('Room', roomSchema, 'HOTEL_ROOMS');