const User = require("../../models/user.model");
const Role = require("../../models/role.model");
const ServiceProvider = require("../../models/service-provider.model");
const Tour = require("../../models/tour.model");
const TourBooking = require("../../models/tour-booking.model");
const AdBooking = require("../../models/adbooking.model");
const bcrypt = require("bcryptjs");

// Helper function để mã hóa mật khẩu
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// @desc    Lấy danh sách tất cả người dùng (ĐÃ SỬA LỖI FILTER VÀ POPULATE)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;

    const queryConditions = [];
    if (search) {
      const searchRegex = new RegExp(search, "i");
      queryConditions.push({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      });
    }
    if (status) {
      queryConditions.push({ status: status });
    }
    if (role) {
      const roleDoc = await Role.findOne({ role_name: role });
      if (roleDoc) {
        // Chỉ cần query theo trường 'role'
        queryConditions.push({ role: roleDoc._id });
      } else {
        return res
          .status(200)
          .json({
            success: true,
            data: { users: [], pagination: { total_users: 0 } },
          });
      }
    }

    const finalQuery =
      queryConditions.length > 0 ? { $and: queryConditions } : {};

    const total_users = await User.countDocuments(finalQuery);
    const total_pages = Math.ceil(total_users / limit);

    const users = await User.find(finalQuery)
      .select("-password")
      .populate("role", "role_name") // Giờ populate sẽ luôn hoạt động đúng
      .sort({ createdAt: -1 }) // Sắp xếp mặc định theo ngày tạo mới nhất
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

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
        },
      },
    });
  } catch (error) {
    console.error("Lỗi trong getAllUsers:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ===== CÁC HÀM KHÁC GIỮ NGUYÊN =====

// @desc    Lấy các số liệu thống kê cho Dashboard (từ AD_BOOKINGS)
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Lấy tháng hiện tại (đầu tháng và cuối tháng)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Lấy tổng người dùng (từ User model)
    const totalUsers = await User.countDocuments({});
    const totalProviders = await ServiceProvider.countDocuments({});

    // Thống kê từ AD_BOOKINGS
    // 1. Tổng doanh thu từ quảng cáo đã thanh toán
    const totalRevenueResult = await AdBooking.aggregate([
      {
        $match: {
          payment_status: "paid"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$price" }
        }
      }
    ]);
    const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].total : 0;

    // 2. Doanh thu tháng này (từ ad booking đã paid trong tháng hiện tại)
    const revenueThisMonthResult = await AdBooking.aggregate([
      {
        $match: {
          payment_status: "paid",
          createdAt: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$price" }
        }
      }
    ]);
    const revenueThisMonth = revenueThisMonthResult.length > 0 ? revenueThisMonthResult[0].total : 0;

    // 3. Số quảng cáo đang hoạt động
    const activeAds = await AdBooking.countDocuments({
      status: "active"
    });

    // 4. Tổng số quảng cáo đã thanh toán
    const paidAds = await AdBooking.countDocuments({
      payment_status: "paid"
    });

    // 5. Số quảng cáo đang chờ thanh toán
    const pendingPaymentAds = await AdBooking.countDocuments({
      payment_status: "pending"
    });

    // 6. Tổng lượt đặt quảng cáo (tổng số ad bookings)
    const totalAdBookings = await AdBooking.countDocuments({});

    // 7. Số quảng cáo đã hủy
    const cancelledAds = await AdBooking.countDocuments({
      status: "cancelled"
    });

    // 8. Tỷ lệ hủy (%)
    const cancellationRate = totalAdBookings > 0 
      ? ((cancelledAds / totalAdBookings) * 100).toFixed(1) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        // Từ User model
        totalUsers: totalUsers + totalProviders,
        
        // Từ AD_BOOKINGS - Doanh thu
        totalRevenue, // Tổng doanh thu từ quảng cáo
        revenueThisMonth, // Doanh thu tháng này
        
        // Từ AD_BOOKINGS - Số lượng
        totalAdBookings, // Tổng lượt đặt quảng cáo
        activeAds, // Số quảng cáo đang hoạt động
        paidAds, // Số quảng cáo đã thanh toán
        pendingPaymentAds, // Số quảng cáo đang chờ thanh toán
        cancelledAds, // Số quảng cáo đã hủy
        cancellationRate: parseFloat(cancellationRate), // Tỷ lệ hủy (%)
      },
    });
  } catch (error) {
    console.error("Lỗi trong getDashboardStats:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy thống kê" });
  }
};

// @desc    Lấy danh sách tour/hotel đang quảng cáo
exports.getActiveAdBookings = async (req, res) => {
  try {
    const activeAds = await AdBooking.find({
      status: "active",
      payment_status: "paid"
    })
      .populate("tour_id", "title description image") // Tour dùng 'image' (singular) và 'title' không phải 'name'
      .populate("hotel_id", "name description images") // Hotel dùng 'images' (plural)
      .populate("provider_id", "name email")
      .sort({ createdAt: -1 })
      .limit(50);

    // Format data để frontend dễ sử dụng
    const formattedAds = activeAds.map((ad) => {
      const adData = {
        id: ad._id,
        ad_type: ad.ad_type,
        start_date: ad.start_date,
        end_date: ad.end_date,
        price: ad.price,
        provider: ad.provider_id ? {
          name: ad.provider_id.name || ad.provider_id.email,
          email: ad.provider_id.email
        } : null,
      };

      if (ad.ad_type === "tour" && ad.tour_id) {
        // Tour có 'image' (singular) và 'title' không phải 'name'
        adData.tour = {
          id: ad.tour_id._id,
          name: ad.tour_id.title || ad.tour_id.name, // Dùng title làm name
          description: ad.tour_id.description,
          image: ad.tour_id.image || null, // Tour dùng 'image' singular
          images: ad.tour_id.image ? [ad.tour_id.image] : [] // Convert thành array để frontend dễ xử lý
        };
      } else if (ad.ad_type === "hotel" && ad.hotel_id) {
        adData.hotel = {
          id: ad.hotel_id._id,
          name: ad.hotel_id.name,
          description: ad.hotel_id.description,
          images: ad.hotel_id.images || []
        };
      }

      return adData;
    });

    res.status(200).json({
      success: true,
      data: formattedAds,
    });
  } catch (error) {
    console.error("Lỗi trong getActiveAdBookings:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy danh sách quảng cáo" });
  }
};

// @desc    Lấy thông tin chi tiết một user
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("role");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User không tồn tại" });
    }

    const userObject = user.toObject();
    userObject.provider_info = null;

    if (user.role.role_name === "ServiceProvider") {
      const provider = await ServiceProvider.findOne({ user_id: user._id });
      if (provider) {
        userObject.provider_info = {
          _id: provider._id,
          company_name: provider.company_name,
          is_verified: provider.is_verified,
          admin_verified: provider.admin_verified,
        };
      }
    }
    res.status(200).json({ success: true, data: userObject });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// @desc    Tạo user mới
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role_name = "Traveler" } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tên, email và mật khẩu là bắt buộc",
        });
    }

    if (await User.findOne({ email })) {
      return res
        .status(400)
        .json({ success: false, message: "Email đã tồn tại" });
    }

    const role = await Role.findOne({ role_name });
    if (!role) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Vai trò '${role_name}' không tồn tại`,
        });
    }

    const user = new User({
      name,
      email,
      phone,
      password: await hashPassword(password),
      role: role._id,
      status: "active",
    });
    await user.save();

    await user.populate("role", "role_name");

    const userObject = user.toObject();
    delete userObject.password;

    res.status(201).json({
      success: true,
      message: "Tạo user thành công",
      data: userObject,
    });
  } catch (error) {
    console.error("Lỗi khi tạo user:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Cập nhật thông tin user
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, role_name, status } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User không tồn tại" });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Email này đã được sử dụng bởi một tài khoản khác.",
          });
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
        return res
          .status(400)
          .json({
            success: false,
            message: `Vai trò '${role_name}' không hợp lệ.`,
          });
      }
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("role", "role_name");

    res.status(200).json({
      success: true,
      message: "Cập nhật user thành công",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật user:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Email đã tồn tại." });
    }
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Xóa user (soft delete)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // 1. Tìm user cần xóa để kiểm tra sự tồn tại và lấy thông tin
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Người dùng không tồn tại" });
    }

    // 2. Xóa các dữ liệu liên quan (để tránh data mồ côi)

    // Nếu user là ServiceProvider, xóa thông tin provider và các tour liên quan
    const provider = await ServiceProvider.findOne({ user_id: userId });
    if (provider) {
      // Xóa tất cả các tour thuộc về provider này
      await Tour.deleteMany({ service_provider_id: provider._id });
      // Xóa bản ghi ServiceProvider
      await ServiceProvider.deleteOne({ _id: provider._id });
    }

    // Xóa tất cả các booking mà user này đã đặt
    await TourBooking.deleteMany({ user_id: userId });

    // 3. Xóa hẳn user khỏi collection 'users'
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Xóa người dùng và các dữ liệu liên quan thành công",
    });
  } catch (error) {
    console.error("Lỗi khi xóa vĩnh viễn user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
// @desc    Ban/Unban user
exports.banUser = async (req, res) => {
  try {
    const { action, reason } = req.body;
    let updateData;

    if (action === "ban") {
      if (!reason)
        return res
          .status(400)
          .json({ success: false, message: "Vui lòng cung cấp lý do ban" });
      updateData = {
        status: "banned",
        ban_reason: reason,
        banned_at: new Date(),
        banned_by: req.user.id,
      };
    } else if (action === "unban") {
      updateData = {
        status: "active",
        ban_reason: null,
        banned_at: null,
        banned_by: null,
      };
    } else {
      return res
        .status(400)
        .json({
          success: false,
          message: "Action không hợp lệ, phải là 'ban' hoặc 'unban'",
        });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User không tồn tại" });
    }
    res
      .status(200)
      .json({
        success: true,
        message: `Đã ${action} user thành công`,
        data: user,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// @desc    Admin đổi mật khẩu cho user
exports.changeUserPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng cung cấp mật khẩu mới" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User không tồn tại" });
    }

    user.password = await hashPassword(new_password);
    user.password_changed_at = new Date();
    await user.save();

    res.status(200).json({ success: true, message: "Đổi password thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// @desc    Lấy thống kê users
exports.getUserStats = async (req, res) => {
  try {
    const total_users = await User.countDocuments();
    // Thêm các logic thống kê khác...
    res.status(200).json({ success: true, data: { total_users } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
