/**
 * Simplified Itinerary Controller
 * Quản lý itineraries cho tours với activities array đơn giản (time + action)
 */

const Itinerary = require('../../../models/itinerary.model');
const Tour = require('../../../models/tour.model');
const mongoose = require('mongoose');

/**
 * @route   POST /api/itineraries
 * @desc    Tạo itinerary mới cho tour
 * @access  Private (Provider)
 */
exports.createItinerary = async (req, res) => {
  try {
    const {
      tour_id,
      day_number,
      title,
      description,
      activities = []
    } = req.body;

    // Validate required fields
    if (!tour_id || !day_number || !title) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin',
        error: 'Missing required fields: tour_id, day_number, title'
      });
    }

    // Validate tour exists
    const tour = await Tour.findById(tour_id);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tour',
        error: 'Tour not found'
      });
    }

    // Validate activities array format
    if (activities && Array.isArray(activities)) {
      for (const activity of activities) {
        if (!activity.time || !activity.action) {
          return res.status(400).json({
            success: false,
            message: 'Mỗi activity phải có time và action',
            error: 'Each activity must have time and action'
          });
        }
      }
    }

    // Create itinerary
    const itinerary = new Itinerary({
      tour_id,
      day_number,
      title,
      description,
      activities: activities || []
    });

    await itinerary.save();

    res.status(201).json({
      success: true,
      message: 'Tạo lịch trình thành công',
      data: itinerary
    });

  } catch (error) {
    console.error('❌ Error creating itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/tour/:tourId
 * @desc    Lấy tất cả itineraries của tour
 * @access  Public
 */
exports.getTourItineraries = async (req, res) => {
  try {
    const { tourId } = req.params;

    // Validate tour exists
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tour',
        error: 'Tour not found'
      });
    }

    const itineraries = await Itinerary.find({ tour_id: tourId })
      .sort({ day_number: 1 });

    res.status(200).json({
      success: true,
      count: itineraries.length,
      data: itineraries
    });

  } catch (error) {
    console.error('❌ Error getting itineraries:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/:id
 * @desc    Lấy chi tiết itinerary
 * @access  Public
 */
exports.getItineraryById = async (req, res) => {
  try {
    const { id } = req.params;

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    res.status(200).json({
      success: true,
      data: itinerary
    });

  } catch (error) {
    console.error('❌ Error getting itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/itineraries/:id
 * @desc    Cập nhật itinerary
 * @access  Private (Provider)
 */
exports.updateItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      day_number,
      title,
      description,
      activities
    } = req.body;

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Validate activities array format if provided
    if (activities && Array.isArray(activities)) {
      for (const activity of activities) {
        if (!activity.time || !activity.action) {
          return res.status(400).json({
            success: false,
            message: 'Mỗi activity phải có time và action',
            error: 'Each activity must have time and action'
          });
        }
      }
    }

    // Update fields
    if (day_number !== undefined) itinerary.day_number = day_number;
    if (title !== undefined) itinerary.title = title;
    if (description !== undefined) itinerary.description = description;
    if (activities !== undefined) itinerary.activities = activities;

    itinerary.updated_at = new Date();
    await itinerary.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật lịch trình thành công',
      data: itinerary
    });

  } catch (error) {
    console.error('❌ Error updating itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/itineraries/:id
 * @desc    Xóa itinerary
 * @access  Private (Provider)
 */
exports.deleteItinerary = async (req, res) => {
  try {
    const { id } = req.params;

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    await Itinerary.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Xóa lịch trình thành công'
    });

  } catch (error) {
    console.error('❌ Error deleting itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa lịch trình',
      error: error.message
    });
  }
};