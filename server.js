const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const mongoose = require("mongoose");

// Import routes
const tourRoutes = require("./routes/tourRoutes");
const hotelRoutes = require("./routes/hotelRoutes");
const flightRoutes = require("./routes/flightRoutes");
const serviceProviderRoutes = require("./routes/serviceProviderRoutes");
const adBookingRoutes = require("./routes/adBooking.routes");
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Hello from Express API 🚀" });
});

// Provider routes
app.use("/api/tour", tourRoutes);
app.use("/api/hotel", hotelRoutes);
app.use("/api/flight", flightRoutes);
app.use("/api/provider", serviceProviderRoutes);
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/profiles", require("./routes/profile.routes"));
//AD_booking
app.use("/api/ad-bookings", adBookingRoutes);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));
// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
