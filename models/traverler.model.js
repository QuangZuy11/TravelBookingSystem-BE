const mongoose = require("mongoose");

const travelerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // mỗi user chỉ có 1 traveler profile
    },
    travel_preferences: {
      type: Object, // hoặc bạn có thể mô tả chi tiết từng field
      default: {},
    },
    favorite_destinations: {
      type: [String], // mảng các địa điểm yêu thích
      default: [],
    },
    travel_interests: {
      type: [String], // mảng các sở thích khi đi du lịch
      default: [],
    },
    budget_preferences: {
      type: [String], // mảng các lựa chọn về ngân sách
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Traveler", travelerSchema);
