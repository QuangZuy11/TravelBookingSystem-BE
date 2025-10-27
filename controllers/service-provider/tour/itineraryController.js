/**
 * Itinerary Controller
 * Quản lý itineraries cho tours
 */

const Itinerary = require('../../../models/itinerary.model');
const Tour = require('../../../models/tour.model');
const ItineraryActivity = require('../../../models/itinerary-activity.model');
const BudgetBreakdown = require('../../../models/budget-breakdown.model');
const PointOfInterest = require('../../../models/point-of-interest.model');
const Destination = require('../../../models/destination.model');
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
      meals,
      accommodation,
      transportation
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

    // Check ownership (skip if no auth)
    // if (req.user && tour.provider_id.toString() !== req.user.service_provider_id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Bạn không có quyền tạo lịch trình cho tour này',
    //     error: 'Access denied'
    //   });
    // }

    // Create itinerary
    const itinerary = new Itinerary({
      tour_id,
      day_number,
      title,
      description,
      meals: meals || [],
      accommodation: accommodation || null,
      transportation: transportation || null,
      activities: []
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
      .populate({
        path: 'activities',
        populate: [
          { path: 'poi_id', select: 'name type location' },
          { path: 'destination_id', select: 'name region country' }
        ]
      })
      .populate('budget_breakdowns')
      .sort({ day_number: 1 });

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách lịch trình thành công',
      data: itineraries
    });

  } catch (error) {
    console.error('❌ Error fetching itineraries:', error);
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
    const itinerary = await Itinerary.findById(req.params.id)
      .populate('tourId', 'title location price duration_hours')
      .populate('providerId', 'company_name')
      .populate({
        path: 'activities',
        populate: [
          { path: 'destination', select: 'name location type images' },
          { path: 'pointsOfInterest', select: 'name type location entryFee openingHours recommendedDuration' }
        ]
      })
      .populate('destinations')
      .populate('budget_breakdowns');

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    res.status(200).json({
      success: true,
      data: itinerary
    });

  } catch (error) {
    console.error('Error fetching itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch itinerary',
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
      meals,
      accommodation,
      transportation,
      notes
    } = req.body;

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Check ownership (skip if no auth)
    // if (req.user && itinerary.provider_id && itinerary.provider_id.toString() !== req.user.service_provider_id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Bạn không có quyền cập nhật lịch trình này',
    //     error: 'Access denied'
    //   });
    // }

    // Update fields
    if (day_number !== undefined) itinerary.day_number = day_number;
    if (title !== undefined) itinerary.title = title;
    if (description !== undefined) itinerary.description = description;
    if (meals !== undefined) itinerary.meals = meals;
    if (accommodation !== undefined) itinerary.accommodation = accommodation;
    if (transportation !== undefined) itinerary.transportation = transportation;
    if (notes !== undefined) itinerary.notes = notes;

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

    // Check ownership (skip if no auth)
    // if (req.user && itinerary.provider_id && itinerary.provider_id.toString() !== req.user.service_provider_id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Bạn không có quyền xóa lịch trình này',
    //     error: 'Access denied'
    //   });
    // }

    // Delete related activities
    await ItineraryActivity.deleteMany({ itinerary_id: itinerary._id });

    // Delete itinerary
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

/**
 * @route   POST /api/itineraries/:itineraryId/activities
 * @desc    Thêm activity vào itinerary
 * @access  Private (Provider)
 */
exports.addActivity = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const {
      poi_id,
      destination_id,
      activity_name,
      start_time,
      end_time,
      duration_hours,
      description,
      cost,
      included_in_tour,
      optional,
      notes
    } = req.body;

    // Validate itinerary exists
    const itinerary = await Itinerary.findById(itineraryId);
    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Check ownership (skip if no auth)
    // if (req.user && itinerary.provider_id.toString() !== req.user.service_provider_id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Bạn không có quyền thêm hoạt động vào lịch trình này',
    //     error: 'Access denied'
    //   });
    // }

    // Validate required fields
    if (!activity_name || !start_time) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin',
        error: 'Missing required fields: activity_name, start_time'
      });
    }

    // Validate POI if provided
    if (poi_id) {
      const poi = await PointOfInterest.findById(poi_id);
      if (!poi) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy điểm tham quan',
          error: 'POI not found'
        });
      }
    }

    // Validate Destination if provided
    if (destination_id) {
      const destination = await Destination.findById(destination_id);
      if (!destination) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy điểm đến',
          error: 'Destination not found'
        });
      }
    }

    // Create activity
    const activity = new ItineraryActivity({
      itinerary_id: itineraryId,
      poi_id: poi_id || null,
      destination_id: destination_id || null,
      activity_name,
      start_time,
      end_time: end_time || null,
      duration_hours: duration_hours || 0,
      description: description || '',
      cost: cost || 0,
      included_in_tour: included_in_tour !== undefined ? included_in_tour : true,
      optional: optional || false,
      notes: notes || ''
    });

    await activity.save();

    itinerary.activities.push(activity._id);
    await itinerary.save();

    // Populate activity relationships
    await activity.populate([
      { path: 'poi_id', select: 'name type location description' },
      { path: 'destination_id', select: 'name region country' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Thêm hoạt động thành công',
      data: activity
    });

  } catch (error) {
    console.error('❌ Error adding activity:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thêm hoạt động',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/itineraries/:itineraryId/activities/:activityId
 * @desc    Cập nhật activity
 * @access  Private (Provider)
 */
exports.updateActivity = async (req, res) => {
  try {
    const { itineraryId, activityId } = req.params;
    const {
      poi_id,
      destination_id,
      activity_name,
      start_time,
      end_time,
      duration_hours,
      description,
      cost,
      included_in_tour,
      optional,
      notes
    } = req.body;

    // Validate activity exists
    const activity = await ItineraryActivity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hoạt động',
        error: 'Activity not found'
      });
    }

    // Validate itinerary exists
    const itinerary = await Itinerary.findById(itineraryId);
    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Check ownership (skip if no auth)
    // if (req.user && itinerary.provider_id && itinerary.provider_id.toString() !== req.user.service_provider_id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Bạn không có quyền cập nhật hoạt động này',
    //     error: 'Access denied'
    //   });
    // }

    // Validate POI if provided
    if (poi_id !== undefined) {
      if (poi_id) {
        const poi = await PointOfInterest.findById(poi_id);
        if (!poi) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy điểm tham quan',
            error: 'POI not found'
          });
        }
      }
      activity.poi_id = poi_id;
    }

    // Validate Destination if provided
    if (destination_id !== undefined) {
      if (destination_id) {
        const destination = await Destination.findById(destination_id);
        if (!destination) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy điểm đến',
            error: 'Destination not found'
          });
        }
      }
      activity.destination_id = destination_id;
    }

    // Update fields (only if provided)
    if (activity_name !== undefined) activity.activity_name = activity_name;
    if (start_time !== undefined) activity.start_time = start_time;
    if (end_time !== undefined) activity.end_time = end_time;
    if (duration_hours !== undefined) activity.duration_hours = duration_hours;
    if (description !== undefined) activity.description = description;
    if (cost !== undefined) activity.cost = cost;
    if (included_in_tour !== undefined) activity.included_in_tour = included_in_tour;
    if (optional !== undefined) activity.optional = optional;
    if (notes !== undefined) activity.notes = notes;

    activity.updated_at = new Date();
    await activity.save();

    // Populate relationships
    await activity.populate([
      { path: 'poi_id', select: 'name type location description' },
      { path: 'destination_id', select: 'name region country' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Cập nhật hoạt động thành công',
      data: activity
    });

  } catch (error) {
    console.error('❌ Error updating activity:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật hoạt động',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/itineraries/:itineraryId/activities/:activityId
 * @desc    Xóa activity
 * @access  Private (Provider)
 */
exports.deleteActivity = async (req, res) => {
  try {
    const { itineraryId, activityId } = req.params;

    // Validate itinerary exists
    const itinerary = await Itinerary.findById(itineraryId);
    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Check ownership (skip if no auth)
    // if (req.user && itinerary.provider_id && itinerary.provider_id.toString() !== req.user.service_provider_id.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Bạn không có quyền xóa hoạt động này',
    //     error: 'Access denied'
    //   });
    // }

    // Validate activity exists
    const activity = await ItineraryActivity.findById(activityId);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hoạt động',
        error: 'Activity not found'
      });
    }

    // Remove from itinerary activities array
    itinerary.activities = itinerary.activities.filter(
      actId => actId.toString() !== activityId
    );
    await itinerary.save();

    // Delete activity
    await ItineraryActivity.findByIdAndDelete(activityId);

    res.status(200).json({
      success: true,
      message: 'Xóa hoạt động thành công'
    });

  } catch (error) {
    console.error('❌ Error deleting activity:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa hoạt động',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/itineraries/:id/budget
 * @desc    Thêm budget breakdown
 * @access  Private (Provider)
 */
exports.addBudgetBreakdown = async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Check ownership
    if (itinerary.providerId.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const {
      category,
      item_name,
      description,
      quantity,
      unit_price,
      currency,
      is_optional,
      is_included,
      day_number,
      activity_id,
      supplier,
      notes
    } = req.body;

    // Create budget item
    const budgetItem = new BudgetBreakdown({
      itinerary_id: itinerary._id,
      category,
      item_name,
      description,
      quantity: quantity || 1,
      unit_price,
      total_price: (quantity || 1) * unit_price,
      currency: currency || 'VND',
      is_optional: is_optional || false,
      is_included: is_included !== undefined ? is_included : true,
      day_number,
      activity_id,
      supplier,
      notes
    });

    await budgetItem.save();

    // Add to itinerary
    itinerary.budget_breakdowns.push(budgetItem._id);

    // Update total cost
    await itinerary.updateTotalCost();

    res.status(201).json({
      success: true,
      message: 'Budget item added successfully',
      data: {
        budget_item: budgetItem,
        total_cost: itinerary.total_cost
      }
    });

  } catch (error) {
    console.error('Error adding budget item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add budget item',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/:id/budget
 * @desc    Lấy budget breakdown của itinerary
 * @access  Public
 */
exports.getBudgetBreakdown = async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    const budgetItems = await BudgetBreakdown.find({ itinerary_id: itinerary._id })
      .populate('activity_id', 'title type')
      .sort({ day_number: 1, category: 1 });

    // Calculate totals
    const totals = await BudgetBreakdown.calculateItineraryTotal(itinerary._id);
    const byCategory = await BudgetBreakdown.calculateByCategory(itinerary._id);

    res.status(200).json({
      success: true,
      data: {
        items: budgetItems,
        summary: {
          total: totals.total,
          included_total: totals.included_total,
          optional_total: totals.optional_total,
          by_category: byCategory
        }
      }
    });

  } catch (error) {
    console.error('Error fetching budget breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget breakdown',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/itineraries/:id/budget/:budgetId
 * @desc    Cập nhật budget item
 * @access  Private (Provider)
 */
exports.updateBudgetItem = async (req, res) => {
  try {
    const { id, budgetId } = req.params;

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Check ownership
    if (itinerary.providerId.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const budgetItem = await BudgetBreakdown.findById(budgetId);
    if (!budgetItem) {
      return res.status(404).json({
        success: false,
        message: 'Budget item not found'
      });
    }

    const allowedUpdates = [
      'category',
      'item_name',
      'description',
      'quantity',
      'unit_price',
      'currency',
      'is_optional',
      'is_included',
      'day_number',
      'activity_id',
      'supplier',
      'notes'
    ];

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        budgetItem[key] = req.body[key];
      }
    });

    await budgetItem.save();

    // Update itinerary total cost
    await itinerary.updateTotalCost();

    res.status(200).json({
      success: true,
      message: 'Budget item updated successfully',
      data: {
        budget_item: budgetItem,
        total_cost: itinerary.total_cost
      }
    });

  } catch (error) {
    console.error('Error updating budget item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update budget item',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/itineraries/:id/budget/:budgetId
 * @desc    Xóa budget item
 * @access  Private (Provider)
 */
exports.deleteBudgetItem = async (req, res) => {
  try {
    const { id, budgetId } = req.params;

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Check ownership
    if (itinerary.providerId.toString() !== req.user.service_provider_id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Remove from itinerary
    itinerary.budget_breakdowns = itinerary.budget_breakdowns.filter(
      itemId => itemId.toString() !== budgetId
    );
    await itinerary.save();

    // Delete budget item
    await BudgetBreakdown.findByIdAndDelete(budgetId);

    // Update total cost
    await itinerary.updateTotalCost();

    res.status(200).json({
      success: true,
      message: 'Budget item deleted successfully',
      data: {
        total_cost: itinerary.total_cost
      }
    });

  } catch (error) {
    console.error('Error deleting budget item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete budget item',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/:itineraryId/activities
 * @desc    Lấy tất cả activities của một itinerary
 * @access  Public
 */
exports.getActivities = async (req, res) => {
  try {
    const { itineraryId } = req.params;

    const itinerary = await Itinerary.findById(itineraryId)
      .populate({
        path: 'activities',
        populate: [
          { path: 'poi_id', select: 'name type location' },
          { path: 'destination_id', select: 'name region country' }
        ]
      });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    res.status(200).json({
      success: true,
      data: itinerary.activities
    });

  } catch (error) {
    console.error('❌ Error getting activities:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/itineraries/:itineraryId/activities/:activityId
 * @desc    Lấy chi tiết một activity
 * @access  Public
 */
exports.getActivityById = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await ItineraryActivity.findById(activityId)
      .populate('poi_id', 'name type location description')
      .populate('destination_id', 'name region country');

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hoạt động',
        error: 'Activity not found'
      });
    }

    res.status(200).json({
      success: true,
      data: activity
    });

  } catch (error) {
    console.error('❌ Error getting activity:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/itineraries/:itineraryId/activities/reorder
 * @desc    Sắp xếp lại thứ tự activities
 * @access  Private (Provider)
 */
exports.reorderActivities = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const { activityIds } = req.body;

    if (!activityIds || !Array.isArray(activityIds)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp danh sách activityIds',
        error: 'activityIds array is required'
      });
    }

    const itinerary = await Itinerary.findById(itineraryId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Validate all activity IDs exist in itinerary
    const currentActivityIds = itinerary.activities.map(id => id.toString());
    const allIdsValid = activityIds.every(id => currentActivityIds.includes(id));

    if (!allIdsValid) {
      return res.status(400).json({
        success: false,
        message: 'Một số activity không thuộc lịch trình này',
        error: 'Invalid activity IDs'
      });
    }

    // Update order
    itinerary.activities = activityIds;
    await itinerary.save();

    res.status(200).json({
      success: true,
      message: 'Sắp xếp lại thứ tự thành công',
      data: {
        activities: itinerary.activities
      }
    });

  } catch (error) {
    console.error('❌ Error reordering activities:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi sắp xếp lại',
      error: error.message
    });
  }
};
