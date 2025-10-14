const User = require('../models/user.model');

// Middleware này sẽ chạy SAU auth.middleware
const checkAdminRole = async (req, res, next) => {
    try {
        // req.user được gán từ auth.middleware
        const user = await User.findById(req.user.id).populate('role');

        if (user && user.role.role_name === 'Admin') {
            next(); // Nếu là Admin, cho đi tiếp
        } else {
            return res.status(403).json({
                success: false,
                message: 'Truy cập bị từ chối. Yêu cầu quyền Admin.'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = { checkAdminRole };