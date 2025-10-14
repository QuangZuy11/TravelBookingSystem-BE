const User = require("../models/user.model");
const Traveler = require("../models/traverler.model");
const bcrypt = require("bcryptjs");

// @desc    Get current user's profile
// @route   GET /api/profiles/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("role", "role_name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const travelerProfile = await Traveler.findOne({ user_id: req.user.id });
    const responseData = user.toObject();

    if (travelerProfile) {
      responseData.traveler = travelerProfile.toObject();
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    console.error("Error in getMe:", err);
    res.status(500).json({
      success: false,
      message: err?.message || "Server Error",
    });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "Khong xac dinh duoc nguoi dung tu token" });
    }

    const {
      name,
      phone,
      email,
      gender,
      date_of_birth,
      city,
      passport_number,
      nationality,
    } = req.body;

    const user = await User.findById(userId).select("-password").populate("role", "role_name");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) {
      user.name = name;
    }
    if (email) {
      user.email = email;
    }

    let parsedDateOfBirth;
    if (date_of_birth) {
      parsedDateOfBirth = new Date(date_of_birth);
      if (Number.isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({ success: false, message: "Ngay sinh khong hop le" });
      }
    }

    const normalizedUserId = user._id;
    let travelerProfile = await Traveler.findOne({ user_id: normalizedUserId });
    const travelerUpdates = {};

    if (phone) travelerUpdates.phone = phone;
    if (city) travelerUpdates.city = city;
    if (passport_number) travelerUpdates.passport_number = passport_number;
    if (nationality) travelerUpdates.nationality = nationality;
    if (gender) travelerUpdates.gender = gender;
    if (date_of_birth) {
      travelerUpdates.date_of_birth = parsedDateOfBirth;
    }

    const hasTravelerUpdates = Object.keys(travelerUpdates).length > 0;

    if (hasTravelerUpdates) {
      if (!travelerProfile) {
        const requiredFields = ["passport_number", "nationality", "gender", "date_of_birth"];
        const missingFields = requiredFields.filter((field) => !travelerUpdates[field]);

        if (missingFields.length) {
          return res.status(400).json({
            success: false,
            message: `Thieu thong tin traveler: ${missingFields.join(", ")}`,
          });
        }

        travelerProfile = new Traveler({
          user_id: normalizedUserId,
          ...travelerUpdates,
        });
      } else {
        travelerProfile.user_id = normalizedUserId;
        Object.assign(travelerProfile, travelerUpdates);
      }
    }

    await user.save();
    if (hasTravelerUpdates) {
      await travelerProfile.save();
    }

    const responseData = user.toObject();

    if (travelerProfile) {
      responseData.traveler = travelerProfile.toObject();
    }

    return res.status(200).json({
      success: true,
      message: "Cap nhat thong tin user thanh cong",
      data: responseData,
    });
  } catch (err) {
    console.error("Error in updateMe:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server Error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui long nhap day du mat khau cu va mat khau moi",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mat khau cu khong dung" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Doi mat khau thanh cong",
    });
  } catch (err) {
    console.error("Error in changePassword:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server Error" });
  }
};
