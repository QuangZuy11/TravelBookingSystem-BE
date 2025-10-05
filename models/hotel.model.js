const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
    service_provider_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider', // Liên kết đến bảng ServiceProviders
        required: true,
    },
    hotel_type: {
        type: String,
        required: true,
        trim: true,
    },
    images: {
        type: [String], // Mảng URL ảnh
        default: [],
    },
    star_rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    address: {
        type: String,
        required: true,
        trim: true,
    },
    facilities: {
        type: String, // hoặc có thể đổi thành [String] nếu bạn muốn lưu danh sách tiện ích
        trim: true,
    },
    policies: {
        type: String,
        trim: true,
    },
}, { timestamps: true }); // tự động tạo createdAt và updatedAt

module.exports = mongoose.model('Hotel', hotelSchema);
