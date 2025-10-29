const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const ServiceProvider = require('../models/service-provider.model');
const { sendMail } = require('../services/email.service');
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

// @route POST /api/auth/forgot-password
// @body  { email }
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'Thiếu email' });

    const user = await User.findOne({ email });
    // Trả về message chung để tránh lộ user tồn tại hay không
    if (!user) {
      return res.json({ success: true, message: 'Nếu email hợp lệ, liên kết đặt lại đã được gửi.' });
    }

    // Tạo token và lưu dạng hash
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await user.save();

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontend}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    await sendMail({
      to: user.email,
      subject: 'Đặt lại mật khẩu - Travel Booking',
      text: `Nhấp vào liên kết để đặt lại mật khẩu (hạn 15 phút): ${resetLink}`,
      html: `
        <p>Chào ${user.name || 'bạn'},</p>
        <p>Nhấp vào liên kết dưới đây để đặt lại mật khẩu (hạn 15 phút):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
      `,
    });

    // Dev support: trả resetLink khi không có SMTP (để bạn test nhanh)
    const reveal = process.env.SMTP_HOST ? undefined : { resetLink };

    return res.json({
      success: true,
      message: 'Nếu email hợp lệ, liên kết đặt lại đã được gửi.',
      ...reveal,
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi gửi yêu cầu đặt lại mật khẩu' });
  }
};

// @route POST /api/auth/reset-password
// @body  { email, token, newPassword }
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu tối thiểu 6 ký tự' });
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      email,
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Cập nhật mật khẩu
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi đặt lại mật khẩu' });
  }
};