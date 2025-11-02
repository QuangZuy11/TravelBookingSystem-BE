/**
 * Simplified Itinerary Controller
 * Quản lý itineraries cho tours với activities array đơn giản (time + action)
 */

const Itinerary = require('../../../models/itinerary.model');
const Tour = require('../../../models/tour.model');
const mongoose = require('mongoose');

/**
 * @route   POST /api/itineraries
 * @desc    Tạo itinerary mới cho tour (UNIFIED ARCHITECTURE: origin_id + type)
 * @access  Private (Provider)
 */
exports.createItinerary = async (req, res) => {
  try {
    const {
      origin_id,
      type = 'tour',
      day_number,
      title,
      description,
      activities = []
    } = req.body;

    // Validate required fields
    if (!origin_id || !day_number || !title) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin',
        error: 'Missing required fields: origin_id, day_number, title'
      });
    }

    // For tour type, validate tour exists
    if (type === 'tour') {
      const tour = await Tour.findById(origin_id);
      if (!tour) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tour',
          error: 'Tour not found'
        });
      }
    }

    // ✅ UNIFIED VALIDATION: Use schema static method
    const validation = Itinerary.validateActivities(activities, type);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        error: validation.error
      });
    }

    // ✅ UNIFIED NORMALIZATION: Use schema static method
    const normalizedActivities = Itinerary.normalizeActivities(activities, type);

    // Create itinerary with UNIFIED architecture
    const itinerary = new Itinerary({
      origin_id,
      type,       // 'tour' for this controller
      day_number,
      title,
      description,
      activities: normalizedActivities
    });

    await itinerary.save();

    // ✅ UNIFIED RESPONSE: Use schema static method
    const formattedResponse = Itinerary.formatResponse(itinerary);

    res.status(201).json({
      success: true,
      message: 'Tạo lịch trình thành công',
      data: formattedResponse
    });

  } catch (error) {
    console.error('❌ Error creating tour itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries?origin_id=xxx&type=tour
 * @desc    Lấy itineraries theo query parameters (UNIFIED ARCHITECTURE)
 * @access  Public
 */
exports.getItinerariesByQuery = async (req, res) => {
  try {
    const { origin_id, type } = req.query;

    // Validate required parameters
    if (!origin_id || !type) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp origin_id và type',
        error: 'Missing required query parameters: origin_id, type'
      });
    }

    // Validate type
    const validTypes = ['tour', 'ai_gen', 'customized'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type không hợp lệ',
        error: `Type must be one of: ${validTypes.join(', ')}`
      });
    }

    // For tour type, validate tour exists
    if (type === 'tour') {
      const tour = await Tour.findById(origin_id);
      if (!tour) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tour',
          error: 'Tour not found'
        });
      }
    }

    // ✅ UNIFIED QUERY: Get itineraries by origin_id + type
    const itineraries = await Itinerary.find({
      origin_id: origin_id,
      type: type
    }).sort({ day_number: 1 });

    // ✅ UNIFIED RESPONSE: Format all itineraries consistently
    const formattedItineraries = itineraries.map(itinerary =>
      Itinerary.formatResponse(itinerary)
    );

    res.status(200).json({
      success: true,
      count: formattedItineraries.length,
      data: formattedItineraries,
      query: { origin_id, type } // Include query params in response for debugging
    });

  } catch (error) {
    console.error('❌ Error getting itineraries by query:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/tour/:tourId
 * @desc    Lấy tất cả itineraries của tour (UNIFIED ARCHITECTURE)
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

    // ✅ UNIFIED QUERY: Use origin_id + type filter
    const itineraries = await Itinerary.find({
      origin_id: tourId,
      type: 'tour'  // Only get tour type itineraries
    }).sort({ day_number: 1 });

    // ✅ UNIFIED RESPONSE: Format all itineraries consistently
    const formattedItineraries = itineraries.map(itinerary =>
      Itinerary.formatResponse(itinerary)
    );

    res.status(200).json({
      success: true,
      count: formattedItineraries.length,
      data: formattedItineraries
    });

  } catch (error) {
    console.error('❌ Error getting tour itineraries:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/:id
 * @desc    Lấy chi tiết itinerary (UNIFIED RESPONSE)
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

    // ✅ UNIFIED RESPONSE: Use schema static method
    const formattedResponse = Itinerary.formatResponse(itinerary);

    res.status(200).json({
      success: true,
      data: formattedResponse
    });

  } catch (error) {
    console.error('❌ Error getting itinerary details:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết lịch trình',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/itineraries/:id
 * @desc    Cập nhật itinerary (UNIFIED VALIDATION)
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

    // ✅ UNIFIED VALIDATION: Use schema static method
    if (activities !== undefined) {
      const validation = Itinerary.validateActivities(activities, itinerary.type);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          error: validation.error
        });
      }
    }

    // Update fields
    if (day_number !== undefined) itinerary.day_number = day_number;
    if (title !== undefined) itinerary.title = title;
    if (description !== undefined) itinerary.description = description;

    // ✅ UNIFIED NORMALIZATION: Use schema static method
    if (activities !== undefined) {
      itinerary.activities = Itinerary.normalizeActivities(activities, itinerary.type);
    }

    itinerary.updated_at = new Date();
    await itinerary.save();

    // ✅ UNIFIED RESPONSE: Use schema static method
    const formattedResponse = Itinerary.formatResponse(itinerary);

    res.status(200).json({
      success: true,
      message: 'Cập nhật lịch trình thành công',
      data: formattedResponse
    });

  } catch (error) {
    console.error('❌ Error updating tour itinerary:', error);
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