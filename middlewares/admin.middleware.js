const User = require('../models/user.model');

const checkAdminRole = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('role')   // Populate trường 'role'
            .populate('role_id'); // Populate cả trường 'role_id'

        // Lấy thông tin role từ một trong hai trường
        const userRole = user.role || user.role_id; 

        if (user && userRole && userRole.role_name === 'Admin') {
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