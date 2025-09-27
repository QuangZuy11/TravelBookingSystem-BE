const User = require('../models/user.model');
const Role = require('../models/role.model');
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
  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'Người dùng đã tồn tại' });
    }

    const defaultRole = await Role.findOne({ role_name: 'Traveler' });
    if (!defaultRole) {
      return res.status(500).json({ success: false, message: 'Default role not found' });
    }
    
    user = new User({
      name,
      email,
      password: await hashPassword(password),
      role: defaultRole._id,
    });
    await user.save();
    
    const token = generateToken({
      user: {
        id: user.id,
        role: defaultRole.role_name
      }
    });

    // Tạo user object để trả về (không bao gồm password)
    const userObject = user.toObject();
    delete userObject.password;
    
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        token,
        user: userObject
      }
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};


// @desc    Authenticate user & get token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).populate('role', 'role_name');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ' });
    }
    
    const token = generateToken({
      user: {
        id: user.id,
        role: user.role.role_name,
      }
    });

    // Tạo user object để trả về (không bao gồm password)
    const userObject = user.toObject();
    delete userObject.password;
    
    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        fullName: user.name,
        email: user.email,
      }
    });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};