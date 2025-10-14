const User = require('../../models/user.model');
const Role = require('../../models/role.model');
const ServiceProvider = require('../../models/service-provider.model');
const Tour = require('../../models/tour.model');
const TourBooking = require('../../models/tour-booking.model');
const bcrypt = require('bcryptjs');

// Helper function để mã hóa mật khẩu
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

// @desc    Lấy danh sách tất cả người dùng (ĐÃ SỬA LỖI FILTER VÀ POPULATE)
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role, status, search, sort = '-created_at' } = req.query;
        
        const queryConditions = [];

        // 1. Điều kiện tìm kiếm (search)
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            queryConditions.push({
                $or: [{ name: searchRegex }, { email: searchRegex }]
            });
        }

        // 2. Điều kiện trạng thái (status)
        if (status) {
            queryConditions.push({ status: status });
        }

        // Lấy tất cả các role và tạo một map để tra cứu (hiệu quả hơn)
        const allRoles = await Role.find({});
        const roleMap = new Map(allRoles.map(r => [r._id.toString(), r]));

        // 3. Điều kiện vai trò (role)
        if (role) {
            const roleDoc = allRoles.find(r => r.role_name === role);
            if (roleDoc) {
                queryConditions.push({
                    $or: [{ role: roleDoc._id }, { role_id: roleDoc._id }]
                });
            } else {
                return res.status(200).json({
                    success: true,
                    data: { users: [], pagination: { total_users: 0, total_pages: 0 } }
                });
            }
        }
        
        const finalQuery = queryConditions.length > 0 ? { $and: queryConditions } : {};
        
        const total_users = await User.countDocuments(finalQuery);
        const total_pages = Math.ceil(total_users / limit);
        
        // Chỉ lấy dữ liệu thô, không populate
        const usersFromDB = await User.find(finalQuery)
            .select('-password')
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        // Tự "populate" thủ công để đảm bảo luôn đúng
        const users = usersFromDB.map(user => {
            const userObject = user.toObject();
            const roleId = user.role?.toString() || user.role_id?.toString();
            
            if (roleId && roleMap.has(roleId)) {
                // Gán object role hoàn chỉnh vào trường 'role'
                userObject.role = roleMap.get(roleId);
            } else {
                // Nếu không tìm thấy, gán là null để frontend không bị lỗi
                userObject.role = null; 
            }
            return userObject;
        });

        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    current_page: parseInt(page),
                    total_pages,
                    total_users,
                    limit: parseInt(limit),
                    has_next: parseInt(page) < total_pages,
                    has_prev: parseInt(page) > 1,
                }
            }
        });
    } catch (error) {
        console.error("Lỗi trong getAllUsers:", error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


// ===== CÁC HÀM KHÁC GIỮ NGUYÊN =====

// @desc    Lấy các số liệu thống kê cho Dashboard
exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

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

        const revenueThisMonth = 58600000;

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

// @desc    Lấy thông tin chi tiết một user
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password').populate('role');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User không tồn tại' });
        }

        const userObject = user.toObject();
        userObject.provider_info = null;

        if (user.role.role_name === 'ServiceProvider') {
            const provider = await ServiceProvider.findOne({ user_id: user._id });
            if (provider) {
                userObject.provider_info = {
                    _id: provider._id,
                    company_name: provider.company_name,
                    is_verified: provider.is_verified,
                    admin_verified: provider.admin_verified
                };
            }
        }
        res.status(200).json({ success: true, data: userObject });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Tạo user mới
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, phone, role_name = 'Traveler' } = req.body;
        
        if (!name || !email || !password) {
             return res.status(400).json({ success: false, message: 'Tên, email và mật khẩu là bắt buộc' });
        }

        if (await User.findOne({ email })) {
            return res.status(400).json({ success: false, message: 'Email đã tồn tại' });
        }

        const role = await Role.findOne({ role_name });
        if (!role) {
            return res.status(400).json({ success: false, message: `Vai trò '${role_name}' không tồn tại` });
        }
        
        const user = new User({
            name,
            email,
            phone,
            password: await hashPassword(password),
            role: role._id,
            status: 'active'
        });
        await user.save();

        await user.populate('role', 'role_name');
        
        const userObject = user.toObject();
        delete userObject.password;

        res.status(201).json({ 
            success: true, 
            message: 'Tạo user thành công', 
            data: userObject
        });

    } catch (error) {
        console.error('Lỗi khi tạo user:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

// @desc    Cập nhật thông tin user
exports.updateUser = async (req, res) => {
    try {
        const { name, email, phone, role_name, status } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User không tồn tại' });
        }

        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Email này đã được sử dụng bởi một tài khoản khác.' });
            }
            user.email = email;
        }
        
        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (status) user.status = status;
        if (role_name) {
            const role = await Role.findOne({ role_name });
            if (role) {
                user.role = role._id;
            } else {
                 return res.status(400).json({ success: false, message: `Vai trò '${role_name}' không hợp lệ.` });
            }
        }
        
        await user.save();
        
        const updatedUser = await User.findById(user._id).select('-password').populate('role', 'role_name');

        res.status(200).json({ 
            success: true, 
            message: 'Cập nhật user thành công', 
            data: updatedUser 
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật user:', error);
        if (error.code === 11000) {
             return res.status(400).json({ success: false, message: 'Email đã tồn tại.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

// @desc    Xóa user (soft delete)
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            { status: 'deleted', deleted_at: new Date() },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User không tồn tại' });
        }
        res.status(200).json({ success: true, message: 'Xóa user thành công', data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Ban/Unban user
exports.banUser = async (req, res) => {
    try {
        const { action, reason } = req.body;
        let updateData;

        if (action === 'ban') {
            if (!reason) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do ban' });
            updateData = { status: 'banned', ban_reason: reason, banned_at: new Date(), banned_by: req.user.id };
        } else if (action === 'unban') {
            updateData = { status: 'active', ban_reason: null, banned_at: null, banned_by: null };
        } else {
            return res.status(400).json({ success: false, message: "Action không hợp lệ, phải là 'ban' hoặc 'unban'" });
        }

        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User không tồn tại' });
        }
        res.status(200).json({ success: true, message: `Đã ${action} user thành công`, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Admin đổi mật khẩu cho user
exports.changeUserPassword = async (req, res) => {
    try {
        const { new_password } = req.body;
        if (!new_password) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu mới' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User không tồn tại' });
        }

        user.password = await hashPassword(new_password);
        user.password_changed_at = new Date();
        await user.save();
        
        res.status(200).json({ success: true, message: 'Đổi password thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Lấy thống kê users
exports.getUserStats = async (req, res) => {
    try {
        const total_users = await User.countDocuments();
        // Thêm các logic thống kê khác...
        res.status(200).json({ success: true, data: { total_users } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};