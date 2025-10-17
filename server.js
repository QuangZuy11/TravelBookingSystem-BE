const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const mongoose = require("mongoose");

// Import routes
const tourRoutes = require("./routes/tourRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const hotelRoutes = require("./routes/hotelRoutes");
const flightRoutes = require("./routes/flightRoutes");
const serviceProviderRoutes = require("./routes/serviceProviderRoutes");
const serviceProviderAuthRoutes = require("./routes/serviceProviderAuthRoutes");
const adminServiceProviderRoutes = require("./routes/admin/adminServiceProviderRoutes");
const travelerRoutes = require("./routes/traveler/hotel.routes");
const adBookingRoutes = require("./routes/adBooking.routes");
const travelerTourRoutes = require("./routes/traveler/TourRoutes");
const aiItineraryRoutes = require('./routes/aiItinerary.routes');
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello from Express API 🚀" });
});

/// Traveler routes
app.use("/api/traveler/hotels", travelerRoutes);
// Tour traveler
app.use("/api/traveler/tours", travelerTourRoutes);
//AD_booking
app.use("/api/ad-bookings", adBookingRoutes);
// Provider routes
app.use("/api/tour", tourRoutes);
app.use("/api/itineraries", itineraryRoutes);
app.use("/api/budget-breakdowns", budgetRoutes);
app.use("/api/hotel", hotelRoutes);
app.use("/api/flight", flightRoutes);
app.use("/api/provider", serviceProviderRoutes);
// AI itinerary endpoints
app.use('/api/ai-itineraries', aiItineraryRoutes);
// Auth routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/auth/service-provider", serviceProviderAuthRoutes);
app.use("/api/profiles", require("./routes/profile.routes"));
// Admin routes
app.use("/api/admin/service-providers", adminServiceProviderRoutes);
app.use('/api/admin', require('./routes/admin/admin.routes'));
// Trong server.js
// ... các routes khác


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));
// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
