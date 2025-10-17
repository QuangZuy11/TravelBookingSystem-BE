const express = require("express");
const router = express.Router();

const {
  getAllToursForTraveler,
  getTourById,
} = require("../../controllers/traveler/tourController.js");

router.get("/", getAllToursForTraveler);
router.get("/:id", getTourById);

module.exports = router;
