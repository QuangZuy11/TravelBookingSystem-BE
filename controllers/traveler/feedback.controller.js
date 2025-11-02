const mongoose = require("mongoose");
const Feedback = require("../../models/feedback.model");
const Tour = require("../../models/tour.model");

// 🧾 Lấy feedback theo tour_id
exports.getFeedbacksByTour = async (req, res) => {
  try {
    const { tour_id } = req.params;
    const feedbacks = await Feedback.find({ tour_id })
      .populate("user_id", "name email") // lấy thông tin người dùng
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server", error });
  }
};

// 📝 Tạo mới feedback
exports.createFeedback = async (req, res) => {
  try {
    const { tour_id, comment, rating } = req.body;
    const user_id = req.user?._id || req.user?.id;

    // Kiểm tra authentication
    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập. Vui lòng đăng nhập để đánh giá.",
      });
    }

    // Kiểm tra dữ liệu đầu vào
    if (!tour_id || !comment || !rating) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu cần thiết. Vui lòng điền đầy đủ thông tin.",
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Đánh giá phải từ 1 đến 5 sao.",
      });
    }

    // Convert tour_id và user_id sang ObjectId nếu cần
    let tourObjectId;
    try {
      if (mongoose.Types.ObjectId.isValid(tour_id)) {
        tourObjectId = new mongoose.Types.ObjectId(tour_id);
      } else {
        return res.status(400).json({
          success: false,
          message: "Tour ID không hợp lệ.",
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Tour ID không hợp lệ.",
      });
    }

    let userObjectId;
    try {
      if (mongoose.Types.ObjectId.isValid(user_id)) {
        userObjectId = new mongoose.Types.ObjectId(user_id);
      } else {
        return res.status(400).json({
          success: false,
          message: "User ID không hợp lệ.",
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "User ID không hợp lệ.",
      });
    }

    // Tạo feedback mới
    const feedback = new Feedback({
      user_id: userObjectId,
      tour_id: tourObjectId,
      comment,
      rating,
    });

    // Kiểm tra tour có tồn tại không
    const tour = await Tour.findById(tourObjectId);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tour này.",
      });
    }

    await feedback.save();


    // Cập nhật rating trung bình cho tour
    const allFeedbacks = await Feedback.find({ tour_id: tourObjectId });
    const avgRating =
      allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length;

    await Tour.findByIdAndUpdate(tourObjectId, {
      rating: avgRating.toFixed(1),
      total_rating: allFeedbacks.length,
    });

    res.status(201).json({
      success: true,
      message: "Đánh giá đã được tạo thành công!",
      feedback,
    });
  } catch (error) {
    console.error("❌ Error creating feedback:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// 👤 Lấy feedback theo user ID
exports.getFeedbacksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const feedbacks = await Feedback.find({ user_id: userId })
      .populate("tour_id", "title image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi server", error });
  }
};

// ✏️ Cập nhật feedback
exports.updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating } = req.body;
    const user_id = req.user?._id || req.user?.id;

    if (!user_id) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    // Kiểm tra quyền: chỉ user tạo feedback mới được sửa
    if (feedback.user_id.toString() !== user_id.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền sửa đánh giá này" });
    }

    // Cập nhật feedback
    if (comment) feedback.comment = comment;
    if (rating) feedback.rating = rating;
    await feedback.save();

    // Cập nhật rating trung bình cho tour
    const allFeedbacks = await Feedback.find({ tour_id: feedback.tour_id });
    const avgRating =
      allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / allFeedbacks.length;

    await Tour.findByIdAndUpdate(feedback.tour_id, {
      rating: avgRating.toFixed(1),
      total_rating: allFeedbacks.length,
    });

    res.status(200).json({
      success: true,
      message: "Đánh giá đã được cập nhật!",
      feedback,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};

// ❌ Xóa feedback
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?._id || req.user?.id;

    if (!user_id) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }

    // Kiểm tra quyền: chỉ user tạo feedback mới được xóa
    if (feedback.user_id.toString() !== user_id.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa đánh giá này" });
    }

    const tour_id = feedback.tour_id;
    await Feedback.findByIdAndDelete(id);

    // Cập nhật rating trung bình cho tour
    const allFeedbacks = await Feedback.find({ tour_id });
    const avgRating =
      allFeedbacks.length > 0
        ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) /
        allFeedbacks.length
        : 0;

    await Tour.findByIdAndUpdate(tour_id, {
      rating: avgRating.toFixed(1),
      total_rating: allFeedbacks.length,
    });

    res.status(200).json({
      success: true,
      message: "Đánh giá đã được xóa!",
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};
