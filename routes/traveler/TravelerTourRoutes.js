const express = require("express");
const router = express.Router();

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

router.get("/:id", async (req, res, next) => {
  try {
    await getTourById(req, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
