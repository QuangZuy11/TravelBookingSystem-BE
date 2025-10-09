const User = require('../models/user.model');
const traveler = require("../models/traverler.model");
const bcrypt = require("bcryptjs");
// @desc    Get current user's profile
// @route   GET /api/profiles/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // req.user được gán trong middleware auth.js
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('role', 'role_name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email } = req.body;

    // Tìm user
    let user = await User.findById(userId).select("-password").populate("role", "role_name");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Cập nhật các trường
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (email) user.email = email;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin user thành công",
      data: user,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email, gender, date_of_birth, city } = req.body;

    let user = await User.findById(userId).select("-password").populate("role", "role_name");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (email) user.email = email;
    if (gender) user.gender = gender;
    if (city) user.city = city;
    if (date_of_birth) user.date_of_birth = new Date(date_of_birth);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin user thành công",
      data: user,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không đúng" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};