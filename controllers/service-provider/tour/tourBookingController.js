/**
 * Tour Booking Controller
 * Handles all booking operations for tours
 */

const TourBooking = require("../../../models/tour-booking.model");
const Tour = require("../../../models/tour.model");
const mongoose = require("mongoose");

/**
 * @route   POST /api/tour-bookings
 * @desc    Create a new tour booking
 * @access  Private (Customer)
 */
exports.createTourBooking = async (req, res) => {
  try {
    const {
      tour_id,
      tour_date,
      participants,
      participant_details,
      contact_info,
      special_requests,
      dietary_requirements,
      pickup_info,
      payment_method,
    } = req.body;

    // Validate tour exists
    const tour = await Tour.findById(tour_id);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Tour not found",
      });
    }

    // Find available date entry
    const dateEntry = tour.available_dates.find(
      (d) =>
        d.date.toISOString().split("T")[0] ===
        new Date(tour_date).toISOString().split("T")[0]
    );

    if (!dateEntry) {
      return res.status(404).json({
        success: false,
        message: "Tour is not available on this date",
      });
    }

    if (dateEntry.status !== "available") {
      return res.status(400).json({
        success: false,
        message: `This date is ${dateEntry.status}. Cannot create booking.`,
      });
    }

    // Check if date has enough slots
    const totalParticipants =
      participants.adults + participants.children + participants.infants;
    const availableSlots = dateEntry.available_slots - dateEntry.booked_slots;

    if (availableSlots < totalParticipants) {
      return res.status(400).json({
        success: false,
        message: `Not enough slots available. Only ${availableSlots} slots left`,
      });
    }

    // Check booking deadline
    const hoursUntilTour =
      (new Date(tour_date) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilTour < tour.booking_info.booking_deadline) {
      return res.status(400).json({
        success: false,
        message: `Booking must be made at least ${tour.booking_info.booking_deadline} hours before the tour`,
      });
    }

    // Generate booking number
    const booking_number = await TourBooking.generateBookingNumber();

    // Calculate pricing
    const adult_price = tour.pricing.base_price;
    const child_price = tour.pricing.child_price;
    const infant_price = tour.pricing.infant_price || 0;

    const subtotal =
      participants.adults * adult_price +
      participants.children * child_price +
      participants.infants * infant_price;

    // Apply group discount if applicable
    let discount = 0;
    if (totalParticipants >= tour.pricing.group_discount.min_people) {
      discount =
        (subtotal * tour.pricing.group_discount.discount_percent) / 100;
    }

    const tax = (subtotal - discount) * 0.1; // 10% tax
    const service_fee = (subtotal - discount) * 0.02; // 2% service fee
    const total_amount = subtotal - discount + tax + service_fee;

    // Create booking
    const booking = new TourBooking({
      booking_number,
      tour_id,
      customer_id: req.user._id,
      provider_id: tour.provider_id,
      tour_date,
      participants,
      total_participants: totalParticipants,
      participant_details,
      pricing: {
        adult_price,
        child_price,
        infant_price,
        subtotal,
        discount,
        tax,
        service_fee,
        total_amount,
      },
      payment: {
        method: payment_method,
        status: "pending",
      },
      contact_info,
      special_requests,
      dietary_requirements,
      pickup_info,
    });

    await booking.save();

    // Update tour date slots
    await tour.bookSlots(tour_date, totalParticipants);

    // Update tour current participants
    tour.capacity.current_participants += totalParticipants;
    await tour.save();

    // Populate booking data
    await booking.populate([
      { path: "tour_id", select: "title location image duration_hours" },
      { path: "customer_id", select: "username email phone_number" },
    ]);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error creating tour booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/tour-bookings/my-bookings
 * @desc    Get all bookings for logged-in user
 * @access  Private (Customer)
 */
exports.getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer_id: req.user._id };
    if (status) {
      query.status = status;
    }

    const bookings = await TourBooking.find(query)
      .populate("tour_id", "title location image duration_hours rating")
      .sort({ booking_date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await TourBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching my bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/tour-bookings/:id
 * @desc    Get booking by ID
 * @access  Private
 */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id)
      .populate("tour_id")
      .populate("customer_id", "username email phone_number")
      .populate("provider_id", "company_name contact_email");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check access rights
    if (
      req.user.role === "customer" &&
      booking.customer_id._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/tour-bookings/:id/confirm
 * @desc    Confirm a booking (Provider only)
 * @access  Private (Provider)
 */
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if provider owns this booking
    if (
      booking.provider_id.toString() !== req.user.service_provider_id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be confirmed",
      });
    }

    booking.status = "confirmed";
    booking.confirmed_at = new Date();
    booking.confirmed_by = req.user._id;
    booking.provider_notes = req.body.notes || "";

    await booking.save();

    // TODO: Send confirmation email

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm booking",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/tour-bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private
 */
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check access rights
    const isCustomer =
      req.user.role === "customer" &&
      booking.customer_id.toString() === req.user._id.toString();
    const isProvider =
      req.user.role === "ServiceProvider" &&
      booking.provider_id.toString() ===
        req.user.service_provider_id.toString();

    if (!isCustomer && !isProvider) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: "This booking cannot be cancelled",
      });
    }

    // Calculate refund
    const refundInfo = booking.calculateRefund();

    booking.status = "cancelled";
    booking.cancellation = {
      is_cancelled: true,
      cancelled_at: new Date(),
      cancelled_by: req.user._id,
      cancellation_reason: req.body.reason || "No reason provided",
      refund_percentage: refundInfo.refund_percentage,
    };

    await booking.save();

    // Update tour date slots
    const tour = await Tour.findById(booking.tour_id);
    await tour.cancelBookingSlots(
      booking.tour_date,
      booking.total_participants
    );

    // Update tour current participants
    tour.capacity.current_participants -= booking.total_participants;
    await tour.save();

    // TODO: Process refund
    // TODO: Send cancellation email

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        booking,
        refund_info: refundInfo,
      },
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/tour-bookings/:id/payment
 * @desc    Update payment status
 * @access  Private
 */
exports.updatePayment = async (req, res) => {
  try {
    const { transaction_id, status } = req.body;

    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    booking.payment.status = status;
    booking.payment.transaction_id = transaction_id;

    if (status === "completed") {
      booking.payment.paid_at = new Date();
      booking.status = "paid";
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/tour/bookings/provider/all
 * @desc    Get all bookings for provider
 * @access  Private (Provider)
 */
exports.getProviderBookings = async (req, res) => {
  try {
    const {
      status,
      date,
      booking_date,
      payment_status,
      booking_status,
      search,
      page = 1,
      limit = 10,
      sort_by = "booking_date",
      order = "desc",
    } = req.query;

    // Get provider_id from token or find from user_id
    let providerId = req.user.service_provider_id;

    // If not in token, try to find from ServiceProvider model
    if (!providerId) {
      const ServiceProvider = require("../../../models/service-provider.model");
      const userId = req.user._id || req.user.id;
      const provider = await ServiceProvider.findOne({ user_id: userId });
      if (provider) {
        providerId = provider._id;
      } else {
        return res.status(403).json({
          success: false,
          message: "Không tìm thấy thông tin nhà cung cấp dịch vụ",
          error: "Service provider not found",
        });
      }
    }

    // Convert to ObjectId if needed
    if (typeof providerId === "string") {
      providerId = new mongoose.Types.ObjectId(providerId);
    }

    const query = { provider_id: providerId };

    // Filter by status (booking status)
    if (booking_status) {
      query.status = booking_status;
    } else if (status) {
      // Backward compatibility
      query.status = status;
    }

    // Filter by payment status
    if (payment_status) {
      query["payment.status"] = payment_status;
    }

    // Filter by booking_date (ngày đặt tour)
    if (booking_date) {
      const selectedDate = new Date(booking_date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.booking_date = { $gte: selectedDate, $lt: nextDate };
    } else if (date) {
      // Backward compatibility: filter by tour_date
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.tour_date = { $gte: selectedDate, $lt: nextDate };
    }

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    let sortObj = {};
    if (sort_by === "booking_date") {
      sortObj.booking_date = sortOrder;
    } else if (sort_by === "tour_date") {
      sortObj.tour_date = sortOrder;
    } else if (sort_by === "total_amount") {
      sortObj["pricing.total_amount"] = sortOrder;
    } else {
      sortObj.created_at = sortOrder;
    }

    // Search by customer name or booking number
    if (search) {
      const User = require("../../../models/user.model");
      const users = await User.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");
      const userIds = users.map((u) => u._id);
      if (userIds.length > 0) {
        query.$or = [
          { booking_number: { $regex: search, $options: "i" } },
          { customer_id: { $in: userIds } },
        ];
      } else {
        // Only search by booking number if no users found
        query.$or = [{ booking_number: { $regex: search, $options: "i" } }];
      }
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const bookings = await TourBooking.find(query)
      .populate("tour_id", "title destination image")
      .populate("customer_id", "name email")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const count = await TourBooking.countDocuments(query);

    // Format bookings for response (tương tự hotel bookings)
    const formattedBookings = bookings.map((booking) => ({
      _id: booking._id,
      booking_number: booking.booking_number,
      customer_name: booking.customer_id?.name || "N/A",
      customer_email: booking.customer_id?.email || "N/A",
      tour_title: booking.tour_id?.title || "N/A",
      booking_date: booking.booking_date,
      tour_date: booking.tour_date,
      total_amount: booking.pricing?.total_amount || 0,
      payment_status: booking.payment?.status || "pending",
      booking_status: booking.status,
      participants: booking.total_participants || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        bookings: formattedBookings,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching provider tour bookings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách đặt tour",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @route   PUT /api/tour-bookings/:id/check-in
 * @desc    Check-in a traveler (mark as attended)
 * @access  Private (Provider)
 */
exports.checkInBooking = async (req, res) => {
  try {
    console.log("Check-in request:", {
      bookingId: req.params.id,
      userId: req.user._id,
      serviceProviderId: req.user.service_provider_id,
    });

    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Get provider_id from token or find from user_id
    let providerId = req.user.service_provider_id;

    // If not in token, try to find from ServiceProvider model
    if (!providerId) {
      const ServiceProvider = require("../../../models/service-provider.model");
      const userId = req.user._id || req.user.id;
      const provider = await ServiceProvider.findOne({ user_id: userId });
      if (provider) {
        providerId = provider._id;
      } else {
        return res.status(403).json({
          success: false,
          message: "Không tìm thấy thông tin nhà cung cấp dịch vụ",
          error: "Service provider not found",
        });
      }
    }

    // Convert to ObjectId if needed
    if (typeof providerId === "string") {
      providerId = new mongoose.Types.ObjectId(providerId);
    }

    // Ensure booking.provider_id is ObjectId for comparison
    const bookingProviderId =
      booking.provider_id instanceof mongoose.Types.ObjectId
        ? booking.provider_id
        : new mongoose.Types.ObjectId(booking.provider_id);

    // Check if provider owns this booking
    if (!bookingProviderId.equals(providerId)) {
      console.error("Provider ID mismatch:", {
        bookingProviderId: bookingProviderId.toString(),
        providerId: providerId.toString(),
        bookingId: booking._id,
      });
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate booking can be checked in
    if (booking.status === "cancelled" || booking.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Cannot check-in a cancelled or refunded booking",
      });
    }

    // Check if already checked in
    if (booking.attendance_status === "attended") {
      return res.status(400).json({
        success: false,
        message: "Traveler has already been checked in",
      });
    }

    // Update attendance status
    booking.attendance_status = "attended";
    booking.checked_in_at = new Date();

    // Ensure checked_in_by is ObjectId
    if (providerId instanceof mongoose.Types.ObjectId) {
      booking.checked_in_by = providerId;
    } else {
      booking.checked_in_by = new mongoose.Types.ObjectId(providerId);
    }

    // Update booking status to in_progress if it's paid/confirmed
    if (booking.status === "paid" || booking.status === "confirmed") {
      booking.status = "in_progress";
    }

    console.log("Saving booking with:", {
      attendance_status: booking.attendance_status,
      checked_in_at: booking.checked_in_at,
      checked_in_by: booking.checked_in_by?.toString(),
      checked_in_by_type: booking.checked_in_by?.constructor?.name,
      status: booking.status,
      providerId: providerId?.toString(),
    });

    // Validate before save
    const validationError = booking.validateSync();
    if (validationError) {
      console.error("Validation error:", validationError);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: validationError.message,
        details: validationError.errors,
      });
    }

    await booking.save();

    console.log("Booking saved successfully");

    // Create notification for traveler
    try {
      const notificationService = require("../../../services/notification.service");

      // Get customer_id before populate (it might be ObjectId)
      const customerId =
        booking.customer_id instanceof mongoose.Types.ObjectId
          ? booking.customer_id
          : booking.customer_id?._id || booking.customer_id;

      if (!customerId) {
        console.error("⚠️ No customer_id found in booking");
        throw new Error("Customer ID not found");
      }

      // Populate tour to get tour name
      await booking.populate("tour_id", "title");

      const tourName =
        booking.tour_id?.title || booking.tour_id?.name || "Tour";

      console.log("Creating check-in notification:", {
        userId: customerId.toString(),
        bookingId: booking._id.toString(),
        bookingNumber: booking.booking_number,
        tourName,
        tourDate: booking.tour_date,
      });

      await notificationService.createTourCheckInNotification({
        userId: customerId.toString(),
        bookingId: booking._id,
        bookingNumber: booking.booking_number,
        tourName: tourName,
        tourDate: booking.tour_date,
      });

      console.log(
        "✅ Check-in notification created for traveler:",
        customerId.toString()
      );
    } catch (notificationError) {
      // Don't fail the check-in if notification fails
      console.error(
        "⚠️ Failed to create check-in notification:",
        notificationError
      );
      console.error("Notification error stack:", notificationError.stack);
    }

    res.status(200).json({
      success: true,
      message: "Traveler checked in successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error checking in booking:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to check in booking",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

/**
 * @route   PUT /api/tour-bookings/:id/mark-no-show
 * @desc    Manually mark a booking as no-show (Provider)
 * @access  Private (Provider)
 */
exports.markNoShow = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Get provider_id from token or find from user_id
    let providerId = req.user.service_provider_id;

    // If not in token, try to find from ServiceProvider model
    if (!providerId) {
      const ServiceProvider = require("../../../models/service-provider.model");
      const userId = req.user._id || req.user.id;
      const provider = await ServiceProvider.findOne({ user_id: userId });
      if (provider) {
        providerId = provider._id;
      } else {
        return res.status(403).json({
          success: false,
          message: "Không tìm thấy thông tin nhà cung cấp dịch vụ",
          error: "Service provider not found",
        });
      }
    }

    // Convert to ObjectId if needed
    if (typeof providerId === "string") {
      providerId = new mongoose.Types.ObjectId(providerId);
    }

    // Ensure booking.provider_id is ObjectId for comparison
    const bookingProviderId =
      booking.provider_id instanceof mongoose.Types.ObjectId
        ? booking.provider_id
        : new mongoose.Types.ObjectId(booking.provider_id);

    // Check if provider owns this booking
    if (!bookingProviderId.equals(providerId)) {
      console.error("Provider ID mismatch:", {
        bookingProviderId: bookingProviderId.toString(),
        providerId: providerId.toString(),
        bookingId: booking._id,
      });
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if already checked in
    if (booking.attendance_status === "attended") {
      return res.status(400).json({
        success: false,
        message: "Cannot mark as no-show if already checked in",
      });
    }

    // Update attendance and booking status
    booking.attendance_status = "no-show";
    booking.status = "no-show";
    booking.no_show_at = new Date();

    await booking.save();

    // Send notifications
    try {
      const {
        createTourNoShowNotification,
      } = require("../../../services/notification.service");
      const Notification = require("../../../models/notification.model");

      const tourName = booking.tour_id?.title || "N/A";
      const bookingNumber =
        booking.booking_number ||
        `T-${booking._id.toString().slice(-6).toUpperCase()}`;
      const customerName = booking.customer_id?.name || "Khách hàng";

      // Notify traveler
      await createTourNoShowNotification({
        userId: booking.customer_id?._id || booking.customer_id,
        bookingId: booking._id,
        bookingNumber: bookingNumber,
        tourName: tourName,
        tourDate: booking.tour_date,
      });

      // Notify provider
      await Notification.createNotification({
        user_id: booking.provider_id,
        title: "Khách hàng không đến tour",
        message: `Khách hàng ${customerName} đã không đến tour "${tourName}" vào ngày ${new Date(
          booking.tour_date
        ).toLocaleDateString("vi-VN")}. Mã đặt tour: ${bookingNumber}.`,
        type: "warning",
        status: "unread",
        related_id: booking._id,
        related_type: "TourBooking",
        metadata: {
          bookingNumber,
          tourName,
          tourDate: booking.tour_date,
          customerName,
        },
      });
    } catch (notificationError) {
      console.error("Error sending no-show notifications:", notificationError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      success: true,
      message: "Booking marked as no-show successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error marking booking as no-show:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark booking as no-show",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/tour-bookings/stats
 * @desc    Get booking statistics
 * @access  Private (Provider)
 */
exports.getBookingStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Get provider_id from token or find from user_id
    let providerId = req.user.service_provider_id;

    // If not in token, try to find from ServiceProvider model
    if (!providerId) {
      const ServiceProvider = require("../../../models/service-provider.model");
      const userId = req.user._id || req.user.id;
      const provider = await ServiceProvider.findOne({ user_id: userId });
      if (provider) {
        providerId = provider._id;
      } else {
        return res.status(403).json({
          success: false,
          message: "Không tìm thấy thông tin nhà cung cấp dịch vụ",
          error: "Service provider not found",
        });
      }
    }

    // Convert to ObjectId if needed
    if (typeof providerId === "string") {
      providerId = new mongoose.Types.ObjectId(providerId);
    }

    const matchStage = {
      provider_id: providerId,
    };

    // Filter theo thời gian
    if (start_date || end_date) {
      matchStage.booking_date = {};
      if (start_date) {
        matchStage.booking_date.$gte = new Date(start_date);
      }
      if (end_date) {
        matchStage.booking_date.$lte = new Date(end_date);
      }
    }

    console.log("📊 Tour Booking Statistics Query:", matchStage);

    // Aggregate để tính toán thống kê (tương tự hotel bookings)
    const stats = await TourBooking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          // ✅ Chỉ đếm bookings CONFIRMED, PAID, IN_PROGRESS, và COMPLETED (đã thanh toán)
          // Không đếm 'pending' vì đó chỉ là booking tạm chưa thanh toán
          total_bookings: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["confirmed", "paid", "in_progress", "completed"],
                  ],
                },
                1,
                0,
              ],
            },
          },
          // Tổng số bookings bị hủy
          total_cancellations: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", ["cancelled", "refunded"]],
                },
                1,
                0,
              ],
            },
          },
          // Tổng doanh thu (chỉ tính bookings đã thanh toán)
          total_revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$payment.status", "completed"] },
                    {
                      $in: [
                        "$status",
                        ["confirmed", "paid", "in_progress", "completed"],
                      ],
                    },
                  ],
                },
                { $toDouble: "$pricing.total_amount" },
                0,
              ],
            },
          },
        },
      },
    ]);

    const statistics = stats[0] || {
      total_revenue: 0,
      total_bookings: 0,
      total_cancellations: 0,
    };

    // Tính tỷ lệ hủy (%)
    const totalAll = statistics.total_bookings + statistics.total_cancellations;
    const cancellation_rate =
      totalAll > 0
        ? Math.round((statistics.total_cancellations / totalAll) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        total_revenue: Math.round(statistics.total_revenue),
        total_bookings: statistics.total_bookings,
        total_cancellations: statistics.total_cancellations,
        cancellation_rate: cancellation_rate,
      },
    });
  } catch (error) {
    console.error("❌ Get Tour Booking Statistics Error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thống kê",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @route   PUT /api/tour-bookings/:id/complete
 * @desc    Mark booking as completed
 * @access  Private (Provider)
 */
exports.completeBooking = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (
      booking.provider_id.toString() !== req.user.service_provider_id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (booking.status !== "in_progress" && booking.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Only in-progress or paid bookings can be completed",
      });
    }

    booking.status = "completed";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking marked as completed",
      data: booking,
    });
  } catch (error) {
    console.error("Error completing booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete booking",
      error: error.message,
    });
  }
};
