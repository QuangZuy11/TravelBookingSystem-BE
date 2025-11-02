const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const {
  getAllToursForTraveler,
  getTourById,
} = require("../../controllers/traveler/tourController.js");

router.get("/", async (req, res, next) => {
  try {
    await getAllToursForTraveler(req, res);
  } catch (error) {
    next(error);
  }
});

// Custom validation for tour ID with specific message
const validateTourId = (req, res, next) => {
  if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "ID tour không hợp lệ",
    });
  }
  next();
};

router.get("/:id", validateTourId, async (req, res, next) => {
  try {
    await getTourById(req, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
