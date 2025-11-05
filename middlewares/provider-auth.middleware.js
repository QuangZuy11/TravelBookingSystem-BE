const Hotel = require('../models/hotel.model');
const Room = require('../models/room.model');

/**
 * Middleware kiểm tra quyền Provider
 * Chỉ cho phép provider xem bookings của khách sạn mình sở hữu
 */
exports.requireProvider = async (req, res, next) => {
    try {
        // Debug: Log req.user structure
        console.log('🔍 Provider Auth - req.user:', JSON.stringify(req.user, null, 2));

        // Kiểm tra user đã đăng nhập chưa (phải có req.user từ auth middleware)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập'
            });
        }

        // Kiểm tra role có phải provider không (accept cả 'provider' và 'ServiceProvider')
        const userRole = req.user.role?.toLowerCase();
        console.log('🔍 User Role (lowercase):', userRole);

        if (userRole !== 'provider' && userRole !== 'serviceprovider') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ Service Provider mới có quyền truy cập'
            });
        }

        next();
    } catch (error) {
        console.error('Provider Auth Middleware Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi xác thực quyền provider'
        });
    }
};

/**
 * Lấy danh sách Room IDs thuộc về provider
 * Dùng để filter bookings
 */
exports.getProviderRoomIds = async (userId) => {
    try {
        // 1. Tìm ServiceProvider record từ user_id
        const ServiceProvider = require('../models/service-provider.model');
        const provider = await ServiceProvider.findOne({ user_id: userId }).select('_id');

        if (!provider) {
            console.log('⚠️ No ServiceProvider found for user:', userId);
            return [];
        }

        const providerId = provider._id;
        console.log('🔍 Provider ID:', providerId);

        // 2. Tìm tất cả hotels của provider (field name: providerId)
        const hotels = await Hotel.find({
            providerId: providerId
        }).select('_id');

        console.log('🏨 Hotels found for provider:', hotels.length);

        if (!hotels || hotels.length === 0) {
            return [];
        }

        const hotelIds = hotels.map(h => h._id);

        // 3. Tìm tất cả rooms thuộc các hotels này
        const rooms = await Room.find({
            hotelId: { $in: hotelIds }
        }).select('_id');

        console.log('🚪 Rooms found:', rooms.length);

        return rooms.map(r => r._id);
    } catch (error) {
        console.error('Get Provider Room IDs Error:', error);
        return [];
    }
};
