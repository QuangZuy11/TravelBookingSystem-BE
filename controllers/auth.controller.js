const User = require('../models/user.model');
const Role = require('../models/role.model');
const ServiceProvider = require('../models/service-provider.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper function để tạo token
const generateToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
};

// Helper function để mã hóa mật khẩu
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};


// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
    const { name, email, password, role_name } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'Người dùng đã tồn tại'
            });
        }

        const role = await Role.findOne({ role_name: role_name || 'Traveler' });
        if (!role) {
            return res.status(400).json({
                success: false,
                message: `Vai trò '${role_name || 'Traveler'}' không tồn tại`
            });
        }

        user = new User({
            name,
            email,
            password: await hashPassword(password),
            role: role._id,
            // status và ban_reason sẽ có giá trị default từ model
        });
        await user.save();

        const token = generateToken({
            user: {
                id: user.id,
                role: role.role_name
            }
        });
        
        // Trả về fullName để frontend có thể dùng ngay
        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            data: {
                token,
                fullName: user.name,
                email: user.email,
                role: role.role_name
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ'
        });
    }
};


// @desc    Authenticate user & get token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Bỏ .populate('role_id') vì không còn trường này
        let user = await User.findOne({ email })
            .populate('role', 'role_name');

        if (!user) {
            return res.status(400).json({ success: false, message: "Email hoặc mật khẩu không hợp lệ" });
        }
        
        // Kiểm tra tài khoản có bị ban không
        if (user.status === "banned") {
            return res.status(403).json({
                success: false,
                message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
            });
        }
        
        // Đơn giản hóa việc kiểm tra role
        if (!user.role) {
            console.error("❌ User không có role:", user.email);
            return res.status(500).json({
                success: false,
                message: "Tài khoản chưa được gán quyền. Vui lòng liên hệ admin.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Email hoặc mật khẩu không hợp lệ" });
        }

        const token = generateToken({
            user: {
                id: user.id,
                role: user.role.role_name, // Sử dụng user.role trực tiếp
            },
        });

        // Chuẩn bị dữ liệu trả về
        const responseData = {
            token,
            role: user.role.role_name, // Sử dụng user.role trực tiếp
            id: user.id,
            fullName: user.name,
            email: user.email,
        };

        // Nếu là ServiceProvider, lấy thêm thông tin provider
        if (user.role.role_name === "ServiceProvider") {
            const serviceProvider = await ServiceProvider.findOne({ user_id: user._id });
            // Gán provider vào responseData (có thể là null nếu chưa tạo profile)
            responseData.provider = serviceProvider ? serviceProvider.toObject({ virtuals: true }) : null;
        }

        res.status(200).json({
            success: true,
            message: "Đăng nhập thành công",
            data: responseData,
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: "Lỗi máy chủ" });
    }
};