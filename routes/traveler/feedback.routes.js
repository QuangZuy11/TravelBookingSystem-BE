const express = require("express");
const router = express.Router();

const {
  createFeedback,
  getFeedbacksByTour,
  getFeedbacksByUser,
  updateFeedback,
  deleteFeedback,
} = require("../../controllers/traveler/feedback.controller");

// 📝 Tạo mới feedback
router.post("/", async (req, res, next) => {
  try {
    await createFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

// 📦 Lấy feedback theo tour ID
router.get("/tour/:tourId", async (req, res, next) => {
  try {
    await getFeedbacksByTour(req, res);
  } catch (error) {
    next(error);
  }
});

// 👤 Lấy feedback theo user ID
router.get("/user/:userId", async (req, res, next) => {
  try {
    await getFeedbacksByUser(req, res);
  } catch (error) {
    next(error);
  }
});

// ✏️ Cập nhật feedback
router.put("/:id", async (req, res, next) => {
  try {
    await updateFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

// ❌ Xóa feedback
router.delete("/:id", async (req, res, next) => {
  try {
    await deleteFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
