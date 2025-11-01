const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');
const AiItineraryRequest = require('../models/ai_itinerary_request.model');
const Tour = require('../models/tour.model');
const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
const Itinerary = require('../models/itinerary.model');
const aiService = require('../services/ai.service');

// ============================
// Helper Functions
// ============================
const getTotalMinutes = (hours, minutes) => (hours || 0) * 60 + (minutes || 0);

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutesToAdd;
  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;
  return `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
};

// ============================
// 1️⃣ Create AI Itinerary Request
// ============================
exports.createRequest = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.destination_id && payload.destination) {
      const destination = await Destination.findOne({
        name: new RegExp(`^${payload.destination}$`, 'i'),
      });
      if (destination) payload.destination_id = destination._id;
    }

    const request = new AiItineraryRequest(payload);
    await request.save();

    res.status(201).json({
      success: true,
      message: 'AI itinerary request created',
      data: request,
    });
  } catch (err) {
    console.error('Error creating AI request', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ============================
// 2️⃣ Generate Itinerary from Request
// ============================
exports.generateItineraryFromRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await AiItineraryRequest.findById(requestId);
    if (!request)
      return res.status(404).json({ success: false, message: 'Request not found' });

    request.status = 'processing';
    await request.save();

    let destination = null;
    let destinationName = request.destination;

    if (!request.destination_id && request.destination) {
      destination = await Destination.findOne({
        name: new RegExp(`^${request.destination}$`, 'i'),
      });
    } else if (request.destination_id) {
      destination = await Destination.findById(request.destination_id);
    }

    if (!destination) {
      return res.status(400).json({
        success: false,
        message: 'Destination not found for itinerary generation',
      });
    }

    destinationName = destination.name;

    const pois = await PointOfInterest.find({ destinationId: destination._id })
      .sort({ 'ratings.average': -1 })
      .limit(20);

    const days =
      request.duration_days ||
      (request.start_date && request.end_date
        ? Math.ceil((new Date(request.end_date) - new Date(request.start_date)) / (24 * 3600 * 1000)) + 1
        : 3);

    const createdItineraries = [];

    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const dayNumber = dayIndex + 1;
      const itinerary = new Itinerary({
        tour_id: request.tour_id || null,
        day_number: dayNumber,
        title: `Day ${dayNumber} - ${destinationName}`,
        description: `Generated itinerary for ${destinationName} - Day ${dayNumber}`,
        activities: [],
      });

      let currentTime = '09:00';
      const dayPois = pois.slice(dayIndex * 3, (dayIndex + 1) * 3);

      for (const poi of dayPois) {
        const duration = poi.recommendedDuration
          ? getTotalMinutes(poi.recommendedDuration.hours, poi.recommendedDuration.minutes)
          : 120;
        itinerary.activities.push({
          time: currentTime,
          action: `Visit ${poi.name} - ${poi.description || 'Explore this location'}`,
        });
        currentTime = addMinutesToTime(currentTime, duration + 30);
      }

      await itinerary.save();
      createdItineraries.push(itinerary);
    }

    const aiGenerated = new AiGeneratedItinerary({
      request_id: request._id,
      destination_id: destination._id,
      itinerary_data: createdItineraries.map(it => ({ itinerary: it, activities: it.activities })),
      summary: `Generated ${createdItineraries.length} days for ${destinationName}`,
    });

    await aiGenerated.save();

    request.status = 'completed';
    request.ai_response = { generated_id: aiGenerated._id, destination_used: destinationName };
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Itinerary generated successfully',
      data: aiGenerated,
    });
  } catch (err) {
    console.error('Error generating itinerary', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ============================
// 3️⃣ Generate Directly from Payload - Updated for Fast AI
// ============================
exports.generateFromPayload = async (req, res) => {
  try {
    const {
      user_id,
      destination,
      duration_days = 3,
      participant_number = 2,
      age_range,
      budget_level = 'medium',
      budget_total,
      preferences = []
    } = req.body;

    // Validation
    if (!destination || !user_id) {
      return res.status(400).json({
        success: false,
        message: 'Destination and user_id are required'
      });
    }

    console.log(`🚀 Generating AI itinerary for ${destination}, ${duration_days} days`);

    // Convert budget level to VND amount
    let budgetAmount = budget_total;
    if (!budgetAmount) {
      const budgetMap = {
        'low': duration_days * 1000000,      // 1M per day
        'medium': duration_days * 2000000,   // 2M per day  
        'high': duration_days * 5000000      // 5M per day
      };
      budgetAmount = budgetMap[budget_level] || budgetMap['medium'];
    }

    // Prepare data for AI service
    const aiData = {
      destination,
      duration: duration_days,
      budget: budgetAmount,
      interests: preferences,
      travelStyle: budget_level === 'high' ? 'active' : budget_level === 'low' ? 'relaxed' : 'balanced',
      participant_number,
      user_id
    };

    // Generate itinerary using AI service
    const aiResult = await aiService.generateItinerary(aiData);

    // Save request to database
    const request = new AiItineraryRequest({
      user_id,
      destination,
      duration_days,
      participant_number,
      age_range: Array.isArray(age_range) ? age_range : [age_range],
      budget_level,
      budget_total: budgetAmount,
      preferences,
      status: 'completed',
      ai_response: {
        generated_at: new Date(),
        ai_model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
      }
    });
    await request.save();

    // Create AI generated itinerary record
    const aiGenerated = new AiGeneratedItinerary({
      request_id: request._id,
      destination_id: null, // No longer need destination ID from database
      itinerary_data: aiResult.days || [],
      summary: aiResult.title || `AI generated ${duration_days}-day itinerary for ${destination}`,
      ai_metadata: {
        model_used: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        generated_at: new Date(),
        destination_string: destination,
        total_budget: aiResult.total_budget || budgetAmount
      }
    });

    await aiGenerated.save();

    // Update request with AI response
    request.ai_response.generated_id = aiGenerated._id;
    request.ai_response.destination_used = destination;
    await request.save();

    res.status(200).json({
      success: true,
      message: 'AI itinerary generated successfully',
      data: {
        ...aiResult,
        request_id: request._id,
        generated_id: aiGenerated._id,
        request_info: {
          destination,
          duration: duration_days,
          budget: budgetAmount,
          participants: participant_number,
          preferences,
          generated_at: new Date()
        }
      }
    });

  } catch (err) {
    console.error('❌ Error generating AI itinerary:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to generate itinerary',
      error: err.message || 'Internal server error'
    });
  }
};

// ============================
// 4️⃣ Get Itinerary by ID
// ============================
exports.getItineraryById = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const itinerary = await AiGeneratedItinerary.findById(itineraryId)
      .populate('destination_id')
      .populate('request_id');

    if (!itinerary)
      return res.status(404).json({ success: false, message: 'Itinerary not found' });

    res.status(200).json({
      success: true,
      message: 'Itinerary fetched successfully',
      data: itinerary,
    });
  } catch (err) {
    console.error('Error fetching itinerary', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ============================
// 5️⃣ Delete Itinerary
// ============================
exports.deleteItinerary = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    const aiItinerary = await AiGeneratedItinerary.findById(itineraryId);

    if (!aiItinerary)
      return res.status(404).json({ success: false, message: 'Itinerary not found' });

    const itineraryIds = aiItinerary.itinerary_data.map(d => d.itinerary._id);
    await Itinerary.deleteMany({ _id: { $in: itineraryIds } });

    await AiGeneratedItinerary.findByIdAndDelete(itineraryId);

    res.status(200).json({
      success: true,
      message: 'Itinerary deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting itinerary', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ============================
// 6️⃣ Get User Itineraries & Requests
// ============================
exports.getUserItineraries = async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await AiItineraryRequest.find({ user_id: userId }).sort({ created_at: -1 });
    const itineraries = await AiGeneratedItinerary.find({
      request_id: { $in: requests.map(r => r._id) },
    }).sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      message: 'User itineraries retrieved',
      data: { requests, itineraries },
    });
  } catch (err) {
    console.error('Error fetching user itineraries', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

exports.getUserRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await AiItineraryRequest.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(50);
    res.status(200).json({ success: true, message: 'User requests fetched', data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ============================
// 7️⃣ Simplified Activity Management
// ============================

// Update itinerary day (title, description) - Simplified version
exports.updateItineraryDay = async (req, res) => {
  try {
    const { itineraryDayId } = req.params;
    const { title, description } = req.body;

    const itinerary = await Itinerary.findById(itineraryDayId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ngày trong lịch trình'
      });
    }

    if (title) itinerary.title = title;
    if (description) itinerary.description = description;

    await itinerary.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật ngày trong lịch trình thành công',
      data: itinerary
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật',
      error: error.message
    });
  }
};

// Simplified activity management (activities are now simple objects in array)
exports.updateActivity = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Activities are now managed as simple arrays within itinerary days. Use updateItineraryDay to modify the activities array.'
  });
};

exports.addActivity = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Activities are now managed as simple arrays within itinerary days. Use updateItineraryDay to modify the activities array.'
  });
};

exports.deleteActivity = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Activities are now managed as simple arrays within itinerary days. Use updateItineraryDay to modify the activities array.'
  });
};

exports.reorderActivities = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Activities are now managed as simple arrays within itinerary days. Use updateItineraryDay to modify the activities array.'
  });
};
