const User = require('../../models/user.model');
const Tour = require('../../models/tour.model');
const TourBooking = require('../../models/tour-booking.model');
const ServiceProvider = require('../../models/service-provider.model');

// @desc    Lấy các số liệu thống kê cho Dashboard
exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Chạy song song các query để tối ưu hiệu suất
        const [
            totalUsers,
            totalProviders,
            activeTours,
            bookingsToday
        ] = await Promise.all([
            User.countDocuments({}),
            ServiceProvider.countDocuments({}),
            Tour.countDocuments({ status: 'active' }),
            TourBooking.countDocuments({ booking_date: { $gte: today, $lt: tomorrow } })
        ]);

        // (Ví dụ) Tính doanh thu tháng này - bạn có thể tùy chỉnh logic này
        const revenueThisMonth = 58600000; // Giả định

        res.status(200).json({
            success: true,
            data: {
                totalUsers: totalUsers + totalProviders,
                activeTours,
                bookingsToday,
                revenueThisMonth
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Lấy danh sách tất cả người dùng (có phân trang)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password') // Loại bỏ mật khẩu
            .populate('role', 'role_name');

        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Cập nhật thông tin người dùng (bởi Admin)
exports.updateUser = async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, role },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Xóa người dùng (bởi Admin)
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        res.status(200).json({ success: true, message: 'Xóa người dùng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};