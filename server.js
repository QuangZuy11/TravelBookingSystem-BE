const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const mongoose = require("mongoose");
// Import routes
const tourRoutes = require("./routes/tourRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const hotelRoutes = require("./routes/hotelRoutes");
const serviceProviderRoutes = require("./routes/serviceProviderRoutes");
const serviceProviderAuthRoutes = require("./routes/serviceProviderAuthRoutes");
const adminServiceProviderRoutes = require("./routes/admin/adminServiceProviderRoutes");
const travelerRoutes = require("./routes/traveler/hotel.routes");
const travelerHotelRoomRoutes = require("./routes/traveler/hotel-room.routes");
const travelerHotelBookingRoutes = require("./routes/traveler/hotel-booking.routes");
const adBookingRoutes = require("./routes/adBooking.routes");
const travelerTourRoutes = require("./routes/traveler/TravelerTourRoutes");
const travelerPromotionRoutes = require("./routes/traveler/promotion.routes");
const providerPromotionRoutes = require("./routes/provider/promotion.routes");
const aiItineraryRoutes = require("./routes/aiItinerary.routes");
const poiRoutes = require("./routes/poi.routes");
const destinationRoutes = require("./routes/destination.routes");
const fileUploadRoutes = require("./routes/fileUpload.routes");
const imageProxyRoutes = require("./routes/imageProxy.routes");
const travelerFeedbackRoutes = require("./routes/traveler/feedback.routes");
// Middleware
app.use(cors());
// Increase payload limit for file uploads (50MB for JSON, 50MB for URL-encoded)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from public directory (for test pages)
app.use("/public", express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello from Express API 🚀" });
});

/// Traveler routes
app.use("/api/traveler/hotels", travelerRoutes);
app.use("/api/traveler/promotions", travelerPromotionRoutes);
app.use("/api/traveler/hotels", travelerHotelRoomRoutes);
app.use("/api/traveler/bookings", travelerHotelBookingRoutes);
app.use("/api/traveler/feedbacks", travelerFeedbackRoutes);
// Tour traveler
app.use("/api/traveler/tours", travelerTourRoutes);
//AD_booking
app.use("/api/ad-bookings", adBookingRoutes);
// Provider routes
app.use("/api/tour", tourRoutes);
app.use("/api/itineraries", itineraryRoutes);
app.use("/api/budget-breakdowns", budgetRoutes);
app.use("/api/hotel", hotelRoutes);
app.use("/api/provider/promotions", providerPromotionRoutes);
// flight functionality removed
app.use("/api/provider", serviceProviderRoutes);
// AI itinerary endpoints
app.use("/api/ai-itineraries", aiItineraryRoutes);
// POI endpoints
app.use("/api/poi", poiRoutes);
// Destination endpoints
app.use("/api/destinations", destinationRoutes);
// File upload endpoints
app.use("/api/upload", fileUploadRoutes);
// Image proxy endpoint (for bypassing CORS on Google Drive images)
app.use("/api", imageProxyRoutes);
// Auth routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/auth/service-provider", serviceProviderAuthRoutes);
app.use("/api/profiles", require("./routes/profile.routes"));
// Admin routes
app.use("/api/admin/service-providers", adminServiceProviderRoutes);
app.use("/api/admin", require("./routes/admin/admin.routes"));
// Trong server.js
// ... các routes khác

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));
// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
