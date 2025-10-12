/**
 * Tour Dates Controller
 * Quản lý available dates cho tours (thay thế Schedule model)
 */

const Tour = require('../../../models/tour.model');
const TourBooking = require('../../../models/tour-booking.model');
const mongoose = require('mongoose');

/**
 * @route   POST /api/tours/:tourId/dates
 * @desc    Thêm ngày khả dụng cho tour
 * @access  Private (Provider)
 */
exports.addAvailableDate = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { date, available_slots, guide_id, special_notes } = req.body;

    const tour = await Tour.findById(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    // Check if provider owns this tour
    if (tour.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if date already exists
    const existingDate = tour.available_dates.find(d => 
      d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
    );

    if (existingDate) {
      return res.status(400).json({
        success: false,
        message: 'This date already exists for this tour'
      });
    }

    // Add date
    await tour.addAvailableDate(date, available_slots, guide_id);

    res.status(201).json({
      success: true,
      message: 'Available date added successfully',
      data: tour
    });

  } catch (error) {
    console.error('Error adding available date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add available date',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/tours/:tourId/dates/bulk
 * @desc    Thêm nhiều ngày (recurring dates)
 * @access  Private (Provider)
 */
exports.addBulkDates = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { start_date, end_date, frequency, available_slots, guide_id } = req.body;

    const tour = await Tour.findById(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    if (tour.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const dates = [];
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Check if date not already exists
      const existingDate = tour.available_dates.find(d => 
        d.date.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]
      );

      if (!existingDate) {
        dates.push({
          date: new Date(currentDate),
          available_slots: available_slots || tour.capacity.max_participants,
          booked_slots: 0,
          status: 'available',
          guide_id: guide_id || null
        });
      }

      // Increment based on frequency
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    tour.available_dates.push(...dates);
    await tour.save();

    res.status(201).json({
      success: true,
      message: `${dates.length} dates added successfully`,
      data: { added_dates: dates.length, tour }
    });

  } catch (error) {
    console.error('Error adding bulk dates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add dates',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/tours/:tourId/dates
 * @desc    Lấy tất cả available dates của tour
 * @access  Public
 */
exports.getTourDates = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { from_date, to_date, status } = req.query;

    const tour = await Tour.findById(tourId)
      .populate('available_dates.guide_id', 'username email phone_number');

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    let dates = tour.available_dates;

    // Filter by date range
    if (from_date) {
      dates = dates.filter(d => d.date >= new Date(from_date));
    }
    if (to_date) {
      dates = dates.filter(d => d.date <= new Date(to_date));
    }

    // Filter by status
    if (status) {
      dates = dates.filter(d => d.status === status);
    }

    // Sort by date
    dates.sort((a, b) => a.date - b.date);

    res.status(200).json({
      success: true,
      count: dates.length,
      data: {
        tour_id: tour._id,
        tour_title: tour.title,
        available_dates: dates
      }
    });

  } catch (error) {
    console.error('Error fetching tour dates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dates',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/tours/:tourId/dates/:date/availability
 * @desc    Check availability cho ngày cụ thể
 * @access  Public
 */
exports.checkDateAvailability = async (req, res) => {
  try {
    const { tourId, date } = req.params;
    const { participants = 1 } = req.query;

    const tour = await Tour.findById(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    const dateEntry = tour.available_dates.find(d => 
      d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
    );

    if (!dateEntry) {
      return res.status(404).json({
        success: false,
        message: 'This date is not available for booking'
      });
    }

    const availableSlots = dateEntry.available_slots - dateEntry.booked_slots;

    res.status(200).json({
      success: true,
      data: {
        date: dateEntry.date,
        status: dateEntry.status,
        total_slots: dateEntry.available_slots,
        booked_slots: dateEntry.booked_slots,
        available_slots: availableSlots,
        can_book: dateEntry.status === 'available' && availableSlots >= parseInt(participants),
        requested_participants: parseInt(participants)
      }
    });

  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/tours/:tourId/dates/:date
 * @desc    Cập nhật thông tin date
 * @access  Private (Provider)
 */
exports.updateDate = async (req, res) => {
  try {
    const { tourId, date } = req.params;
    const { available_slots, guide_id, special_notes, status } = req.body;

    const tour = await Tour.findById(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    if (tour.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const dateEntry = tour.available_dates.find(d => 
      d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
    );

    if (!dateEntry) {
      return res.status(404).json({
        success: false,
        message: 'Date not found'
      });
    }

    // Update fields
    if (available_slots !== undefined) dateEntry.available_slots = available_slots;
    if (guide_id !== undefined) dateEntry.guide_id = guide_id;
    if (special_notes !== undefined) dateEntry.special_notes = special_notes;
    if (status !== undefined) dateEntry.status = status;

    await tour.save();

    res.status(200).json({
      success: true,
      message: 'Date updated successfully',
      data: dateEntry
    });

  } catch (error) {
    console.error('Error updating date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update date',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/tours/:tourId/dates/:date
 * @desc    Xóa available date
 * @access  Private (Provider)
 */
exports.deleteDate = async (req, res) => {
  try {
    const { tourId, date } = req.params;

    const tour = await Tour.findById(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    if (tour.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const dateEntry = tour.available_dates.find(d => 
      d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
    );

    if (!dateEntry) {
      return res.status(404).json({
        success: false,
        message: 'Date not found'
      });
    }

    // Check if there are bookings for this date
    const bookingsCount = await TourBooking.countDocuments({
      tour_id: tourId,
      tour_date: {
        $gte: new Date(date),
        $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      },
      status: { $nin: ['cancelled', 'completed'] }
    });

    if (bookingsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete date with ${bookingsCount} active bookings. Cancel bookings first.`
      });
    }

    // Remove date
    tour.available_dates = tour.available_dates.filter(d => 
      d.date.toISOString().split('T')[0] !== new Date(date).toISOString().split('T')[0]
    );

    await tour.save();

    res.status(200).json({
      success: true,
      message: 'Date deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete date',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/tours/:tourId/dates/:date/cancel
 * @desc    Cancel date và auto-cancel tất cả bookings
 * @access  Private (Provider)
 */
exports.cancelDate = async (req, res) => {
  try {
    const { tourId, date } = req.params;
    const { reason } = req.body;

    const tour = await Tour.findById(tourId);

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    if (tour.provider_id.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const dateEntry = tour.available_dates.find(d => 
      d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
    );

    if (!dateEntry) {
      return res.status(404).json({
        success: false,
        message: 'Date not found'
      });
    }

    // Cancel date
    dateEntry.status = 'cancelled';
    dateEntry.special_notes = reason || 'Cancelled by provider';
    await tour.save();

    // Cancel all bookings for this date
    const bookings = await TourBooking.find({
      tour_id: tourId,
      tour_date: {
        $gte: new Date(date),
        $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      },
      status: { $nin: ['cancelled', 'completed'] }
    });

    for (const booking of bookings) {
      booking.status = 'cancelled';
      booking.cancellation = {
        is_cancelled: true,
        cancelled_at: new Date(),
        cancelled_by: req.user._id,
        cancellation_reason: reason || 'Tour date cancelled by provider',
        refund_percentage: 100 // Full refund
      };
      await booking.save();

      // TODO: Process refunds
      // TODO: Send cancellation emails
    }

    res.status(200).json({
      success: true,
      message: 'Date cancelled successfully',
      data: {
        cancelled_date: dateEntry,
        cancelled_bookings: bookings.length
      }
    });

  } catch (error) {
    console.error('Error cancelling date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel date',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/tours/dates/search
 * @desc    Tìm tours available theo date
 * @access  Public
 */
exports.searchToursByDate = async (req, res) => {
  try {
    const { date, location, min_slots } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    const query = {
      status: 'active',
      'available_dates': {
        $elemMatch: {
          date: {
            $gte: new Date(date),
            $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
          },
          status: 'available'
        }
      }
    };

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    if (min_slots) {
      query['available_dates'].$elemMatch.$expr = {
        $gte: [
          { $subtract: ['$available_slots', '$booked_slots'] },
          parseInt(min_slots)
        ]
      };
    }

    const tours = await Tour.find(query)
      .select('title location price duration_hours rating image available_dates')
      .populate('provider_id', 'company_name');

    // Filter available_dates to only show the searched date
    const filteredTours = tours.map(tour => {
      const tourObj = tour.toObject();
      tourObj.available_dates = tourObj.available_dates.filter(d => 
        d.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0] &&
        d.status === 'available'
      );
      return tourObj;
    });

    res.status(200).json({
      success: true,
      count: filteredTours.length,
      data: filteredTours
    });

  } catch (error) {
    console.error('Error searching tours by date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search tours',
      error: error.message
    });
  }
};
