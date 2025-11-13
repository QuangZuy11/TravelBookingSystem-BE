const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active",
    },
    ban_reason: { type: String },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // ✅ Traveler profile info
    traveler_profile: {
      total_bookings: { type: Number, default: 0 },
      completed_trips: { type: Number, default: 0 },
      cancelled_bookings: { type: Number, default: 0 },
      total_spent: { type: Number, default: 0 },
      preferred_destinations: [{ type: String }],
      travel_preferences: {
        accommodation_type: { type: String, enum: ['hotel', 'hostel', 'resort', 'any'], default: 'any' },
        transportation_type: { type: String, enum: ['private', 'shared', 'public', 'any'], default: 'any' },
        activity_level: { type: String, enum: ['relaxed', 'moderate', 'active'], default: 'moderate' },
        budget_level: { type: String, enum: ['budget', 'mid-range', 'luxury'], default: 'mid-range' }
      }
    },

    // ✅ Notification preferences
    notification_settings: {
      email_booking_updates: { type: Boolean, default: true },
      email_price_quotes: { type: Boolean, default: true },
      sms_booking_updates: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.virtual("traveler", {
  ref: "Traveler",
  localField: "_id",
  foreignField: "user_id",
  justOne: true,
});

userSchema.virtual("hotelBookings", {
  ref: "HotelBooking",
  localField: "_id",
  foreignField: "user_id",
});

userSchema.virtual("tourBookings", {
  ref: "TourBooking",
  localField: "_id",
  foreignField: "user_id",
});

module.exports = mongoose.model("User", userSchema, "USERS");
