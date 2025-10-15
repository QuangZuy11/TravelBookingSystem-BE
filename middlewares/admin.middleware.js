const User = require('../models/user.model');

const checkAdminRole = async (req, res, next) => {
    try {
        // Chỉ cần populate trường 'role'
        const user = await User.findById(req.user.id).populate('role');

        // Kiểm tra trực tiếp, không cần biến userRole phụ
        if (user && user.role && user.role.role_name === 'Admin') {
            next();
        } else {
            return res.status(403).json({
                success: false,
                message: 'Truy cập bị từ chối. Yêu cầu quyền Admin.'
            });
        }
    } catch (error) {
        console.error('Lỗi trong admin.middleware:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = { checkAdminRole };