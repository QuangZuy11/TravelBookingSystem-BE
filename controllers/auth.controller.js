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
      return res.status(500).json({
        success: false,
        message: `Role ${role_name} không tồn tại`
      });
    }

    user = new User({
      name,
      email,
      password: await hashPassword(password),
      role: role._id,
    });
    await user.save();

    const token = generateToken({
      user: {
        id: user.id,
        role: role.role_name
      }
    });

    res.status(200).json({
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
    let user = await User.findOne({ email })
      .populate('role', 'role_name')
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ' });
    }

    const userRole = user.role;
    if (!userRole) {
      console.error('❌ User không có role:', user.email);
      return res.status(500).json({ 
        success: false, 
        message: 'Tài khoản chưa được gán quyền. Vui lòng liên hệ admin.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ' });
    }

    const token = generateToken({
      user: {
        id: user.id,
        role: userRole.role_name,
      }
    });

    const userObject = user.toObject();
    delete userObject.password;

    // Prepare response data
    const responseData = {
      token,
      role: userRole.role_name,
      id: user.id,
      fullName: user.name,
      email: user.email,
    };

    // If user is ServiceProvider, include provider info
    if (userRole.role_name === 'ServiceProvider') {
      const serviceProvider = await ServiceProvider.findOne({ user_id: user._id });
      
      if (serviceProvider) {
        // Provider exists - return full info
        responseData.provider = {
          _id: serviceProvider._id,
          user_id: serviceProvider.user_id,
          company_name: serviceProvider.company_name,
          contact_person: serviceProvider.contact_person,
          email: serviceProvider.email,
          phone: serviceProvider.phone,
          address: serviceProvider.address,
          type: serviceProvider.type,
          service_types: serviceProvider.type, // Alias for backward compatibility
          licenses: serviceProvider.licenses.map(l => ({
            _id: l._id,
            service_type: l.service_type,
            license_number: l.license_number,
            verification_status: l.verification_status,
            verified_at: l.verified_at,
            verified_by: l.verified_by,
            rejection_reason: l.rejection_reason,
            documents: l.documents
          })),
          rating: serviceProvider.rating,
          total_reviews: serviceProvider.total_reviews,
          is_verified: serviceProvider.is_verified,
          has_pending_verification: serviceProvider.has_pending_verification,
          created_at: serviceProvider.created_at,
          updated_at: serviceProvider.updated_at
        };
      } else {
        // Provider role but no profile yet - return null
        responseData.provider = null;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: responseData
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};