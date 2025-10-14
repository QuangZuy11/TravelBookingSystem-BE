const mongoose = require("mongoose");

const travelerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      alias: "userId",
    },
    passport_number: {
      type: String,
      required: true,
      unique: true,
    },
    nationality: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    city: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    date_of_birth: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Traveler", travelerSchema);
