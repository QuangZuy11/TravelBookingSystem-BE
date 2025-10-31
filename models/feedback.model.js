const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    // Liên kết người dùng (ai viết đánh giá)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // tên model User
      required: true,
    },

    // Liên kết với tour được đánh giá
    tour_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour", // tên model Tour
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

module.exports =
  mongoose.models.Feedback ||
  mongoose.model("Feedback", feedbackSchema, "FEEDBACKS");
