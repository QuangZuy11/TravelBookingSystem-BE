/**
 * Tour Booking Controller
 * Handles all booking operations for tours
 */

const TourBooking = require('../../../models/tour-booking.model');
const Tour = require('../../../models/tour.model');
const mongoose = require('mongoose');

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
      payment_method
    } = req.body;

    // Validate tour exists
    const tour = await Tour.findById(tour_id);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    // Find available date entry
    const dateEntry = tour.available_dates.find(d => 
      d.date.toISOString().split('T')[0] === new Date(tour_date).toISOString().split('T')[0]
    );

    if (!dateEntry) {
      return res.status(404).json({
        success: false,
        message: 'Tour is not available on this date'
      });
    }

    if (dateEntry.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `This date is ${dateEntry.status}. Cannot create booking.`
      });
    }

    // Check if date has enough slots
    const totalParticipants = participants.adults + participants.children + participants.infants;
    const availableSlots = dateEntry.available_slots - dateEntry.booked_slots;
    
    if (availableSlots < totalParticipants) {
      return res.status(400).json({
        success: false,
        message: `Not enough slots available. Only ${availableSlots} slots left`
      });
    }

    // Check booking deadline
    const hoursUntilTour = (new Date(tour_date) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilTour < tour.booking_info.booking_deadline) {
      return res.status(400).json({
        success: false,
        message: `Booking must be made at least ${tour.booking_info.booking_deadline} hours before the tour`
      });
    }

    // Generate booking number
    const booking_number = await TourBooking.generateBookingNumber();

    // Calculate pricing
    const adult_price = tour.pricing.base_price;
    const child_price = tour.pricing.child_price;
    const infant_price = tour.pricing.infant_price || 0;

    const subtotal = 
      (participants.adults * adult_price) +
      (participants.children * child_price) +
      (participants.infants * infant_price);

    // Apply group discount if applicable
    let discount = 0;
    if (totalParticipants >= tour.pricing.group_discount.min_people) {
      discount = (subtotal * tour.pricing.group_discount.discount_percent) / 100;
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
        total_amount
      },
      payment: {
        method: payment_method,
        status: 'pending'
      },
      contact_info,
      special_requests,
      dietary_requirements,
      pickup_info
    });

    await booking.save();

    // Update tour date slots
    await tour.bookSlots(tour_date, totalParticipants);

    // Update tour current participants
    tour.capacity.current_participants += totalParticipants;
    await tour.save();

    // Populate booking data
    await booking.populate([
      { path: 'tour_id', select: 'title location image duration_hours' },
      { path: 'customer_id', select: 'username email phone_number' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error creating tour booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
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
      .populate('tour_id', 'title location image duration_hours rating')
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
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching my bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
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
      .populate('tour_id')
      .populate('customer_id', 'username email phone_number')
      .populate('provider_id', 'company_name contact_email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check access rights
    if (req.user.role === 'customer' && booking.customer_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
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
        message: 'Booking not found'
      });
    }

    // Check if provider owns this booking
    if (booking.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be confirmed'
      });
    }

    booking.status = 'confirmed';
    booking.confirmed_at = new Date();
    booking.confirmed_by = req.user._id;
    booking.provider_notes = req.body.notes || '';

    await booking.save();

    // TODO: Send confirmation email

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm booking',
      error: error.message
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
        message: 'Booking not found'
      });
    }

    // Check access rights
    const isCustomer = req.user.role === 'customer' && booking.customer_id.toString() === req.user._id.toString();
    const isProvider = req.user.role === 'ServiceProvider' && booking.provider_id.toString() === req.user.service_provider_id.toString();

    if (!isCustomer && !isProvider) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled'
      });
    }

    // Calculate refund
    const refundInfo = booking.calculateRefund();

    booking.status = 'cancelled';
    booking.cancellation = {
      is_cancelled: true,
      cancelled_at: new Date(),
      cancelled_by: req.user._id,
      cancellation_reason: req.body.reason || 'No reason provided',
      refund_percentage: refundInfo.refund_percentage
    };

    await booking.save();

    // Update tour date slots
    const tour = await Tour.findById(booking.tour_id);
    await tour.cancelBookingSlots(booking.tour_date, booking.total_participants);

    // Update tour current participants
    tour.capacity.current_participants -= booking.total_participants;
    await tour.save();

    // TODO: Process refund
    // TODO: Send cancellation email

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking,
        refund_info: refundInfo
      }
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
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
        message: 'Booking not found'
      });
    }

    booking.payment.status = status;
    booking.payment.transaction_id = transaction_id;

    if (status === 'completed') {
      booking.payment.paid_at = new Date();
      booking.status = 'paid';
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/tour-bookings/provider/bookings
 * @desc    Get all bookings for provider
 * @access  Private (Provider)
 */
exports.getProviderBookings = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;

    const query = { provider_id: req.user.service_provider_id };
    
    if (status) {
      query.status = status;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.tour_date = { $gte: startDate, $lt: endDate };
    }

    const bookings = await TourBooking.find(query)
      .populate('tour_id', 'title location')
      .populate('customer_id', 'username email phone_number')
      .sort({ tour_date: 1, booking_date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await TourBooking.countDocuments(query);

    // Calculate statistics
    const stats = await TourBooking.aggregate([
      { $match: { provider_id: new mongoose.Types.ObjectId(req.user.service_provider_id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_revenue: { $sum: '$pricing.total_amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: bookings,
      statistics: stats,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching provider bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
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

    const matchStage = { provider_id: new mongoose.Types.ObjectId(req.user.service_provider_id) };

    if (start_date && end_date) {
      matchStage.booking_date = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const stats = await TourBooking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total_bookings: { $sum: 1 },
          total_revenue: { $sum: '$pricing.total_amount' },
          total_participants: { $sum: '$total_participants' },
          average_booking_value: { $avg: '$pricing.total_amount' },
          confirmed_bookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          cancelled_bookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          completed_bookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        total_bookings: 0,
        total_revenue: 0,
        total_participants: 0,
        average_booking_value: 0,
        confirmed_bookings: 0,
        cancelled_bookings: 0,
        completed_bookings: 0
      }
    });

  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
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
        message: 'Booking not found'
      });
    }

    if (booking.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (booking.status !== 'in_progress' && booking.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Only in-progress or paid bookings can be completed'
      });
    }

    booking.status = 'completed';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking marked as completed',
      data: booking
    });

  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete booking',
      error: error.message
    });
  }
};
