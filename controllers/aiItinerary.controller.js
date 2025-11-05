const Itinerary = require('../models/itinerary.model');
const AiItineraryRequest = require('../models/ai_itinerary_request.model');
const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
const aiService = require('../services/ai.service');

/**
 * Helper functions for time calculations
 */
// Convert hours + minutes to total minutes
const getTotalMinutes = (hours, minutes) => {
  return (hours || 0) * 60 + (minutes || 0);
};

// Add minutes to time string "HH:MM" and return new time string
const addMinutesToTime = (timeStr, minutesToAdd) => {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutesToAdd;
  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;
  return `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
};

/**
 * Simple AI-like generator (heuristic-based)
 * - Finds destination by name
 * - Picks top POIs in destination
 * - Splits into days and creates Itinerary + ItineraryActivity
 */

exports.createRequest = async (req, res) => {
  try {
    const payload = req.body;
    console.log('🛰️ AI Request payload:', JSON.stringify(payload).slice(0, 1000));
    // Expect payload: { user_id, destination, destination_id (optional), start_date, end_date, duration_days, participant_number, age_range, budget_level, preferences }

    // If destination_id not provided, try to find it by destination name
    if (!payload.destination_id && payload.destination) {
      const destination = await Destination.findOne({ name: new RegExp('^' + payload.destination + '$', 'i') });
      if (destination) {
        payload.destination_id = destination._id;
        console.log(`📍 Auto-matched destination_id: ${destination._id}`);
      }
    }

    const request = new AiItineraryRequest(payload);
    await request.save();

    res.status(201).json({ success: true, message: 'Đã tạo yêu cầu lịch trình AI thành công', data: request });
  } catch (err) {
    console.error('Error creating AI request', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo yêu cầu AI', error: err.message });
  }
};

exports.generateItineraryFromRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await AiItineraryRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });

    console.log(`🛰️ Generating itinerary for request ${requestId}`);
    console.log(`📋 Request details:`, {
      destination: request.destination,
      preferences: request.preferences,
      budget_total: request.budget_total,
      duration_days: request.duration_days
    });

    // Mark processing
    request.status = 'processing';
    await request.save();

    let destination = null;
    let destinationName = request.destination;

    // CASE 1: User doesn't know where to go - AI suggests destination
    if (!request.destination && !request.destination_id) {
      console.log('🤔 User has no destination - asking AI for suggestion...');

      try {
        // Get all available destinations from DB
        const availableDestinations = await Destination.find({}).limit(50);

        if (availableDestinations.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Không có điểm đến nào có sẵn trong cơ sở dữ liệu'
          });
        }

        // Ask AI to suggest best destination
        const suggestion = await aiService.generateDestinationSuggestion({
          request,
          availableDestinations
        });

        console.log('💡 AI suggested destination:', suggestion);

        // Save AI suggestion
        request.ai_suggested_destination = suggestion.suggested_destination_name;
        request.ai_suggested_destination_id = suggestion.suggested_destination_id;
        await request.save();

        // Use suggested destination
        destination = await Destination.findById(suggestion.suggested_destination_id);
        destinationName = suggestion.suggested_destination_name;

        console.log('✅ Using AI suggested destination:', destinationName);
      } catch (aiErr) {
        console.warn('⚠️ AI destination suggestion failed:', aiErr.message);
        // Fallback: pick random popular destination
        const fallbackDest = await Destination.findOne({}).sort({ 'ratings.average': -1 });
        if (fallbackDest) {
          destination = fallbackDest;
          destinationName = fallbackDest.name;
          request.ai_suggested_destination = fallbackDest.name;
          request.ai_suggested_destination_id = fallbackDest._id;
          await request.save();
          console.log('🔄 Fallback to popular destination:', destinationName);
        } else {
          return res.status(400).json({
            success: false,
            message: 'Không thể xác định điểm đến và dịch vụ AI không khả dụng'
          });
        }
      }
    }
    // CASE 2: User specified destination
    else {
      console.log('� User specified destination:', request.destination || 'by ID');

      // Find destination (sử dụng field 'name' theo Destination model)
      if (request.destination_id) {
        destination = await Destination.findById(request.destination_id);
      } else {
        destination = await Destination.findOne({ name: new RegExp('^' + request.destination + '$', 'i') });
      }

      // Update request with destination_id if found
      if (destination && !request.destination_id) {
        request.destination_id = destination._id;
        request.destination = destination.name;
        await request.save();
      }

      destinationName = destination?.name || request.destination;
    }

    console.log('🛰️ Final destination:', destinationName, '| ID:', destination?._id);

    // Fetch POIs for destination, order by rating (sử dụng 'destinationId' theo POI model)
    let pois = [];
    if (destination) {
      pois = await PointOfInterest.find({ destinationId: destination._id })
        .sort({ 'ratings.average': -1 })
        .limit(30);
    } else {
      // Fallback: search POIs by destination string in name
      pois = await PointOfInterest.find({
        name: new RegExp(destinationName, 'i')
      })
        .sort({ 'ratings.average': -1 })
        .limit(30);
    }
    console.log('🛰️ Found POIs:', pois.length);

    // Determine number of days
    const days = request.duration_days || (() => {
      if (request.start_date && request.end_date) {
        const s = new Date(request.start_date);
        const e = new Date(request.end_date);
        const diff = Math.ceil((e - s) / (24 * 3600 * 1000)) + 1;
        return diff;
      }
      return Math.min(5, Math.max(1, Math.floor((pois.length || 3) / 3)));
    })();

    console.log('📅 Duration:', days, 'days');

    // Try to call AI service to generate structured plan
    let aiPlan = null;
    try {
      aiPlan = await aiService.generateItinerary({ request, destination, pois, days });
      console.log('🛰️ AI produced plan:', Array.isArray(aiPlan.days) ? `days=${aiPlan.days.length}` : 'invalid');
    } catch (aiErr) {
      console.warn('⚠️ AI service failed or not configured, falling back to heuristic:', aiErr.message);
    }

    // Create Itinerary and Activities, optionally link to a Tour if provided
    const createdItineraries = [];

    // If request contains a tour reference, try to use it
    let tour = null;
    if (request.tour_id) {
      tour = await Tour.findById(request.tour_id);
    }

    if (aiPlan && Array.isArray(aiPlan.days) && aiPlan.days.length > 0) {
      // Create from AI plan
      for (const day of aiPlan.days) {
        const dayNumber = day.day_number || 1;
        const itObj = new Itinerary({
          tour_id: tour ? tour._id : null,
          provider_id: tour ? tour.provider_id : null,
          day_number: dayNumber,
          title: day.title || `Day ${dayNumber} - ${request.destination}`,
          description: day.description || `Auto-generated itinerary for ${request.destination} - Day ${dayNumber}`,
          activities: []
        });

        await itObj.save();

        const activities = [];
        for (const a of day.activities || []) {
          const poi = a.poi_id ? pois.find(p => String(p._id) === String(a.poi_id)) : null;

          // Calculate duration from POI's recommendedDuration if available
          let durationHours = a.duration_hours || 2;
          if (poi && poi.recommendedDuration) {
            durationHours = (poi.recommendedDuration.hours || 0) + (poi.recommendedDuration.minutes || 0) / 60;
          }

          const act = new ItineraryActivity({
            itinerary_id: itObj._id,
            poi_id: poi ? poi._id : null,
            activity_name: a.activity_name || (poi ? poi.name : 'Activity'), // Sử dụng 'name'
            start_time: a.start_time || '09:00',
            end_time: a.end_time || '11:00',
            duration_hours: durationHours,
            description: a.description || (poi ? poi.description : ''),
            cost: a.cost || (poi ? poi.entryFee?.adult : 0) || 0, // Sử dụng 'entryFee.adult'
            optional: !!a.optional
          });
          await act.save();
          activities.push(act);
          itObj.activities.push(act._id);
        }

        await itObj.save();
        createdItineraries.push({ itinerary: itObj, activities });
      }
    } else {
      // Fallback heuristic: Smart scheduling based on POI recommended duration + travel time
      console.log('🛰️ Using smart heuristic scheduling with duration + travel time');

      // Constants
      const DAY_START_HOUR = 8; // 8:00 AM
      const DAY_END_HOUR = 18; // 6:00 PM
      const TRAVEL_TIME_MINUTES = 30; // 30 minutes between locations
      const DEFAULT_DURATION_HOURS = 2; // Fallback if POI has no recommendedDuration
      const MAX_HOURS_PER_DAY = DAY_END_HOUR - DAY_START_HOUR; // 10 hours

      // Distribute POIs across days EVENLY using round-robin + duration check
      const dayPicks = [];
      for (let d = 0; d < days; d++) dayPicks.push([]);

      // Track time used per day
      const dayMinutes = new Array(days).fill(0);

      // Sort POIs by duration (longest first) for better distribution
      const sortedPois = [...pois].sort((a, b) => {
        const durationA = a.recommendedDuration
          ? getTotalMinutes(a.recommendedDuration.hours, a.recommendedDuration.minutes)
          : DEFAULT_DURATION_HOURS * 60;
        const durationB = b.recommendedDuration
          ? getTotalMinutes(b.recommendedDuration.hours, b.recommendedDuration.minutes)
          : DEFAULT_DURATION_HOURS * 60;
        return durationB - durationA; // Longest first
      });

      // Distribute POIs evenly across days
      for (const poi of sortedPois) {
        // Get POI duration in minutes
        const poiDuration = poi.recommendedDuration
          ? getTotalMinutes(poi.recommendedDuration.hours, poi.recommendedDuration.minutes)
          : DEFAULT_DURATION_HOURS * 60;

        const totalTimeNeeded = poiDuration + TRAVEL_TIME_MINUTES;

        // Find the day with the least time allocated that can still fit this POI
        let bestDay = 0;
        let minTime = dayMinutes[0];

        for (let d = 0; d < days; d++) {
          // Check if this day can fit the POI
          if (dayMinutes[d] + totalTimeNeeded <= MAX_HOURS_PER_DAY * 60) {
            // Prefer days with less time allocated (for balance)
            if (dayMinutes[d] < minTime) {
              minTime = dayMinutes[d];
              bestDay = d;
            }
          }
        }

        // Assign POI to best day
        dayPicks[bestDay].push(poi);
        dayMinutes[bestDay] += totalTimeNeeded;
      }

      console.log('🛰️ Balanced distribution:', dayPicks.map((picks, i) =>
        `Day ${i + 1}: ${picks.length} POIs (${(dayMinutes[i] / 60).toFixed(1)}h)`
      ).join(', '));

      // Create itineraries for each day
      for (let d = 0; d < days; d++) {
        const dayNumber = d + 1;
        const title = `Day ${dayNumber} - ${request.destination}`;
        const itObj = new Itinerary({
          tour_id: tour ? tour._id : null,
          provider_id: tour ? tour.provider_id : null,
          day_number: dayNumber,
          title,
          description: `Auto-generated itinerary for ${request.destination} - Day ${dayNumber}`,
          activities: []
        });

        await itObj.save();

        // Create activities for this day with smart scheduling
        const activities = [];
        const picks = dayPicks[d] || [];

        let currentTime = `${String(DAY_START_HOUR).padStart(2, '0')}:00`; // Start at 8:00 AM

        for (const poi of picks) {
          // Get POI recommended duration
          const durationMinutes = poi.recommendedDuration
            ? getTotalMinutes(poi.recommendedDuration.hours, poi.recommendedDuration.minutes)
            : DEFAULT_DURATION_HOURS * 60;

          const durationHours = durationMinutes / 60;

          const start_time = currentTime;
          const end_time = addMinutesToTime(currentTime, durationMinutes);

          const act = new ItineraryActivity({
            itinerary_id: itObj._id,
            poi_id: poi._id,
            activity_name: poi.name,
            start_time,
            end_time,
            duration_hours: durationHours,
            description: poi.description || '',
            cost: poi.entryFee?.adult || 0,
            optional: false
          });

          await act.save();
          activities.push(act);
          itObj.activities.push(act._id);

          // Next activity starts after current activity + travel time (30 minutes)
          currentTime = addMinutesToTime(end_time, TRAVEL_TIME_MINUTES);
        }

        await itObj.save();
        createdItineraries.push({ itinerary: itObj, activities });
      }
    }

    // Save AI Generated record
    const aiGen = new AiGeneratedItinerary({
      request_id: request._id,
      destination_id: destination ? destination._id : request.destination_id,
      tour_id: tour ? tour._id : null,
      provider_id: tour ? tour.provider_id : null,
      itinerary_data: createdItineraries,
      summary: destination
        ? `Generated ${createdItineraries.length} itinerary days for ${destination.name}`
        : `Generated ${createdItineraries.length} itinerary days for ${destinationName || 'destination'}`
    });
    await aiGen.save();

    // Update request
    request.status = 'completed';
    request.ai_response = {
      generated_id: aiGen._id,
      destination_used: destinationName,
      ai_suggested: !!request.ai_suggested_destination
    };
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Đã tạo lịch trình thành công',
      data: aiGen,
      destination: {
        name: destinationName,
        id: destination?._id,
        ai_suggested: !!request.ai_suggested_destination,
        suggestion_reason: request.ai_response?.suggestion_reason
      }
    });
  } catch (err) {
    console.error('Error generating itinerary', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Simple endpoint to generate directly from payload (without storing request first)
exports.generateFromPayload = async (req, res) => {
  try {
    const payload = req.body; // same fields as request
    const fakeReq = new AiItineraryRequest(payload);
    await fakeReq.save();
    req.params.requestId = fakeReq._id;
    return exports.generateItineraryFromRequest(req, res);
  } catch (err) {
    console.error('Error generating from payload', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Get all itineraries generated by a specific user
exports.getUserItineraries = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🛰️ Fetching itineraries for user ${userId}`);

    // Find all requests by this user
    const requests = await AiItineraryRequest.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(50);

    // Get generated itineraries for these requests
    const requestIds = requests.map(r => r._id);
    const generatedItineraries = await AiGeneratedItinerary.find({
      request_id: { $in: requestIds }
    }).sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      message: 'User itineraries fetched',
      data: {
        requests: requests,
        itineraries: generatedItineraries
      }
    });
  } catch (err) {
    console.error('Error fetching user itineraries', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Get a specific generated itinerary by ID
exports.getItineraryById = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    console.log(`🛰️ Fetching itinerary ${itineraryId}`);

    const itinerary = await AiGeneratedItinerary.findById(itineraryId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Re-query activities from DB to get latest data (not cached embedded data)
    const itineraryDataWithLatest = [];

    for (const dayData of itinerary.itinerary_data) {
      const itineraryDay = await Itinerary.findById(dayData.itinerary._id);

      if (!itineraryDay) continue;

      // Fetch fresh activity data from ItineraryActivity collection
      const activityIds = itineraryDay.activities;
      const activitiesData = await ItineraryActivity.find({ _id: { $in: activityIds } });

      // Sort activities by the order in activityIds array (MongoDB $in doesn't guarantee order)
      const activitiesMap = {};
      activitiesData.forEach(act => {
        activitiesMap[act._id.toString()] = act;
      });

      const activities = activityIds.map(id => activitiesMap[id.toString()]).filter(Boolean);

      // Populate POI details
      for (const activity of activities) {
        if (activity.poi_id) {
          const poi = await PointOfInterest.findById(activity.poi_id);
          activity.poi_details = poi;
        }
      }

      itineraryDataWithLatest.push({
        itinerary: itineraryDay,
        activities: activities
      });
    }

    const response = {
      _id: itinerary._id,
      request_id: itinerary.request_id,
      destination_id: itinerary.destination_id,
      tour_id: itinerary.tour_id,
      provider_id: itinerary.provider_id,
      itinerary_data: itineraryDataWithLatest
    };

    res.status(200).json({
      success: true,
      message: 'Itinerary fetched',
      data: response
    });
  } catch (err) {
    console.error('Error fetching itinerary', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Get all requests by a user
exports.getUserRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🛰️ Fetching requests for user ${userId}`);

    const requests = await AiItineraryRequest.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      message: 'User requests fetched',
      data: requests
    });
  } catch (err) {
    console.error('Error fetching user requests', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Delete an itinerary
exports.deleteItinerary = async (req, res) => {
  try {
    const { itineraryId } = req.params;
    console.log(`🛰️ Deleting itinerary ${itineraryId}`);

    const itinerary = await AiGeneratedItinerary.findById(itineraryId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Delete associated itinerary and activity records
    const itineraryIds = itinerary.itinerary_data.map(d => d.itinerary._id);
    await Itinerary.deleteMany({ _id: { $in: itineraryIds } });

    const activityIds = itinerary.itinerary_data.flatMap(d =>
      d.activities.map(a => a._id)
    );
    await ItineraryActivity.deleteMany({ _id: { $in: activityIds } });

    // Delete the generated itinerary record
    await AiGeneratedItinerary.findByIdAndDelete(itineraryId);

    res.status(200).json({
      success: true,
      message: 'Itinerary deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting itinerary', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Update itinerary day info (title, description)
exports.updateItineraryDay = async (req, res) => {
  try {
    const { itineraryDayId } = req.params;
    const { title, description } = req.body;
    console.log(`🛰️ Updating itinerary day ${itineraryDayId}`);

    const itinerary = await Itinerary.findById(itineraryDayId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Lỗi khi khởi tạo tùy chỉnh',
        error: error.message
      });
    }
  },

  // Unified customize endpoint - handles both initialization, retrieval, and UPDATE
  async customizeItinerary(req, res) {
    try {
      const { aiGeneratedId } = req.params;
      const hasUpdateData = req.body && Object.keys(req.body).length > 0;

      console.log('🔧 customizeItinerary called:', { aiGeneratedId, hasUpdateData, bodyKeys: Object.keys(req.body || {}) });

      // First, check if the provided ID is already a customized AI record
      const providedAiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
      if (providedAiRecord && providedAiRecord.status === 'custom') {
        // This is already a customized AI record, return it directly
        const customizedDays = await Itinerary.find({
          origin_id: aiGeneratedId,
          type: 'customized'
        }).sort({ day_number: 1 });

        const totalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

        // Try to find original AI record by request_id
        let originalAiGeneratedId = null;
        if (providedAiRecord.request_id) {
          const originalAiRecord = await AiGeneratedItinerary.findOne({
            request_id: providedAiRecord.request_id,
            status: 'done'
          });
          originalAiGeneratedId = originalAiRecord ? originalAiRecord._id : null;
        }

        // Handle UPDATE for customized AI record if payload provided
        if (hasUpdateData && req.body.itinerary_data) {
          console.log('🔄 Updating existing customized itinerary...');

          const updatedDays = req.body.itinerary_data;

          // Update each day's data
          for (const dayUpdate of updatedDays) {
            console.log('🔍 Processing dayUpdate:', {
              dayId: dayUpdate.dayId,
              theme: dayUpdate.theme,
              activitiesCount: dayUpdate.activities?.length
            });

            const dayToUpdate = await Itinerary.findById(dayUpdate.dayId);
            if (dayToUpdate && dayToUpdate.origin_id.toString() === aiGeneratedId) {
              console.log('📝 Found day to update:', dayToUpdate._id);

              // Update day fields
              if (dayUpdate.theme) {
                console.log(`🔄 Updating theme: "${dayToUpdate.title}" → "${dayUpdate.theme}"`);
                dayToUpdate.title = dayUpdate.theme;
              }
              if (dayUpdate.description !== undefined) dayToUpdate.description = dayUpdate.description;

              // Handle activities array update carefully
              if (dayUpdate.activities && Array.isArray(dayUpdate.activities)) {
                console.log('🔄 Updating activities for day', dayUpdate.dayNumber);
                console.log('📊 Activities data:', dayUpdate.activities.map(a => ({
                  activityId: a.activityId,
                  activity: a.activity,
                  duration: a.duration,
                  cost: a.cost,
                  type: a.type
                })));

                // ✅ UNIFIED VALIDATION: Use schema static method
                const validation = Itinerary.validateActivities(dayUpdate.activities, 'ai_gen');
                if (!validation.valid) {
                  console.log('❌ Activities validation failed:', validation.error);
                  throw new Error(`Activities validation failed: ${validation.error}`);
                }

                // ✅ UNIFIED NORMALIZATION: Use schema static method  
                const normalizedActivities = Itinerary.normalizeActivities(dayUpdate.activities, 'ai_gen');

                console.log('✅ Activities normalized:', normalizedActivities.map(a => ({
                  activityId: a.activityId,
                  activity: a.activity,
                  activityType: a.activityType,
                  duration: a.duration,
                  cost: a.cost,
                  userModified: a.userModified
                })));

                dayToUpdate.activities = normalizedActivities;

                // ✅ AUTO-CALCULATE dayTotal from activities
                const calculatedDayTotal = normalizedActivities.reduce((sum, activity) => {
                  return sum + (activity.cost || 0);
                }, 0);
                dayToUpdate.day_total = calculatedDayTotal;

                console.log(`💰 Auto-calculated dayTotal: ${calculatedDayTotal} (from ${normalizedActivities.length} activities)`);
              }

              // If dayTotal is explicitly provided, use it (override auto-calculation)
              if (dayUpdate.dayTotal !== undefined && dayUpdate.dayTotal !== null) {
                dayToUpdate.day_total = dayUpdate.dayTotal;
                console.log(`💰 Using explicit dayTotal: ${dayUpdate.dayTotal}`);
              }

              // Mark as user modified
              dayToUpdate.user_modified = true;
              dayToUpdate.updated_at = new Date();

              try {
                await dayToUpdate.save();
                console.log(`✅ Updated customized day ${dayUpdate.dayNumber}: ${dayUpdate.theme}`);
                console.log(`💾 Saved with ${dayToUpdate.activities?.length || 0} activities`);
              } catch (saveError) {
                console.error(`❌ Error saving day ${dayUpdate.dayNumber}:`, saveError.message);
                throw saveError;
              }
            } else {
              console.log('❌ Day not found or wrong origin_id:', {
                dayId: dayUpdate.dayId,
                found: !!dayToUpdate,
                expectedOrigin: aiGeneratedId,
                actualOrigin: dayToUpdate?.origin_id
              });
            }
          }

          // Update AI record summary if provided
          if (req.body.summary) {
            providedAiRecord.summary = req.body.summary;
            providedAiRecord.updated_at = new Date();
            await providedAiRecord.save();
            console.log('✅ Updated customized AI record summary');
          }

          // Get fresh updated data
          const updatedCustomizedDays = await Itinerary.find({
            origin_id: aiGeneratedId,
            type: 'customized'
          }).sort({ day_number: 1 });

          const updatedTotalCost = updatedCustomizedDays.reduce((sum, day) => sum + day.day_total, 0);

          // Set cache control headers to prevent caching
          res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
          });

          return res.json({
            success: true,
            message: 'Cập nhật lịch trình tùy chỉnh thành công',
            data: {
              aiGeneratedId: aiGeneratedId,
              originalAiGeneratedId: originalAiGeneratedId,
              isOriginal: false,
              isCustomizable: true,
              totalCost: updatedTotalCost,
              destination: providedAiRecord.destination,
              duration_days: providedAiRecord.duration_days,
              days: updatedCustomizedDays.map(day => ({
                dayNumber: day.day_number,
                dayId: day._id,
                theme: day.title,
                description: day.description,
                activities: day.activities,
                dayTotal: day.day_total,
                type: day.type,
                originId: day.origin_id,
                userModified: day.user_modified
              }))
            }
          });
        }

        // Set cache control headers to prevent caching
        res.set({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        });

        return res.json({
          success: true,
          message: 'Lấy phiên bản tùy chỉnh thành công',
          data: {
            aiGeneratedId: aiGeneratedId,
            originalAiGeneratedId: originalAiGeneratedId, // Track the original AI record
            isOriginal: false,
            isCustomizable: true,
            totalCost: totalCost,
            destination: providedAiRecord.destination,
            duration_days: providedAiRecord.duration_days,
            days: customizedDays.map(day => ({
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: day.activities,
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id,
              userModified: day.user_modified
            }))
          }
        });
      }

      // Check if customized AI record already exists (based on request_id)
      const originalAiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
      if (!originalAiRecord) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bản ghi AI gốc'
        });
      }

      // Find existing customized AI record with same request_id but status 'custom'
      let customizedAiRecord = await AiGeneratedItinerary.findOne({
        request_id: originalAiRecord.request_id,
        status: 'custom'
      });

      let customizedDays = [];

      // If no customized version exists, initialize it
      if (!customizedAiRecord) {
        console.log(`🔄 No customized version found for ${aiGeneratedId}, initializing...`);

        // Get original AI days (type='ai_gen')
        const originalDays = await Itinerary.find({
          origin_id: aiGeneratedId,
          type: 'ai_gen'
        }).sort({ day_number: 1 });

        if (!originalDays.length) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy lịch trình AI gốc'
          });
        }

        // 1. Clone AI_GENERATED_ITINERARIES record (create new record with custom status)
        const customizedAiData = {
          ...originalAiRecord.toObject(),
          _id: undefined, // Remove _id to create new record
          status: 'custom', // Change status to indicate customized version
          created_at: new Date(),
          updated_at: new Date()
        };
        customizedAiRecord = new AiGeneratedItinerary(customizedAiData);
        await customizedAiRecord.save();

        console.log(`✅ Created customized AI record: ${customizedAiRecord._id}`);

        // 2. Clone ITINERARIES records (keep original, create new customized versions)
        customizedDays = []; // Initialize array for customized days
        for (const originalDay of originalDays) {
          const customizedDay = Itinerary.createCustomizedCopy(originalDay);
          customizedDay.origin_id = customizedAiRecord._id; // Point to new customized AI record
          customizedDay.type = 'customized';
          await customizedDay.save();
          customizedDays.push(customizedDay);
        }

        console.log(`✅ Cloned ${customizedDays.length} ITINERARIES records to customized AI record: ${customizedAiRecord._id}`);
      } else {
        // Get existing customized days
        customizedDays = await Itinerary.find({
          origin_id: customizedAiRecord._id,
          type: 'customized'
        }).sort({ day_number: 1 });

        console.log(`✅ Found existing customized version: ${customizedAiRecord._id} with ${customizedDays.length} days`);
      }

      // Handle UPDATE request if payload provided
      if (hasUpdateData && req.body.itinerary_data) {
        console.log('🔄 Updating customized itinerary with new data...');

        const updatedDays = req.body.itinerary_data;

        // Update each day's data
        for (const dayUpdate of updatedDays) {
          const dayToUpdate = await Itinerary.findById(dayUpdate.dayId);
          if (dayToUpdate && dayToUpdate.origin_id.toString() === (customizedAiRecord ? customizedAiRecord._id.toString() : aiGeneratedId)) {
            // Update day fields
            if (dayUpdate.theme) dayToUpdate.title = dayUpdate.theme;
            if (dayUpdate.description !== undefined) dayToUpdate.description = dayUpdate.description;

            // ✅ UNIFIED ACTIVITIES HANDLING: Use schema static methods
            if (dayUpdate.activities && Array.isArray(dayUpdate.activities)) {
              // Validate activities using unified validation
              const validation = Itinerary.validateActivities(dayUpdate.activities, dayToUpdate.type);
              if (!validation.valid) {
                return res.status(400).json({
                  success: false,
                  message: validation.error,
                  error: validation.error
                });
              }

              // Normalize activities using unified normalization
              const normalizedActivities = Itinerary.normalizeActivities(dayUpdate.activities, dayToUpdate.type);
              dayToUpdate.activities = normalizedActivities;
            }

            if (dayUpdate.dayTotal !== undefined) dayToUpdate.day_total = dayUpdate.dayTotal;

            // Mark as user modified
            dayToUpdate.user_modified = true;
            dayToUpdate.updated_at = new Date();

            await dayToUpdate.save();
            console.log(`✅ Updated day ${dayUpdate.dayNumber}: ${dayUpdate.theme}`);
          }
        }

        // Update AI record summary if provided
        if (customizedAiRecord && req.body.summary) {
          customizedAiRecord.summary = req.body.summary;
          customizedAiRecord.updated_at = new Date();
          await customizedAiRecord.save();
          console.log('✅ Updated AI record summary');
        }

        // Get updated data
        customizedDays = await Itinerary.find({
          origin_id: customizedAiRecord ? customizedAiRecord._id : aiGeneratedId,
          type: 'customized'
        }).sort({ day_number: 1 });
      }

      // Return the customized version (updated or existing)
      const totalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

      // Set cache control headers to prevent caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      res.json({
        success: true,
        message: hasUpdateData ? 'Cập nhật lịch trình tùy chỉnh thành công' : 'Lấy phiên bản tùy chỉnh thành công',
        data: {
          aiGeneratedId: customizedAiRecord ? customizedAiRecord._id : aiGeneratedId, // Use customized AI record ID
          originalAiGeneratedId: aiGeneratedId, // Keep reference to original
          isOriginal: false,
          isCustomizable: true,
          totalCost: totalCost,
          destination: customizedAiRecord ? customizedAiRecord.destination : null,
          duration_days: customizedAiRecord ? customizedAiRecord.duration_days : null,
          lastUpdated: new Date().toISOString(), // Add timestamp to force refresh
          updated: hasUpdateData, // Flag to indicate if this was an update
          days: customizedDays.map(day => {
            const formattedDay = Itinerary.formatResponse(day);
            return {
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: formattedDay.activities, // Use formatted activities
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id,
              userModified: day.user_modified
            };
          })
        }
      });

    } catch (error) {
      console.error('❌ Error in customizeItinerary:', error);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Phiên bản tùy chỉnh đã tồn tại',
          error: 'Duplicate customization'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý tùy chỉnh lịch trình',
        error: error.message
      });
    }
  },

  // Delete AI itinerary (both AI record and associated day records)
  async deleteItinerary(req, res) {
    try {
      const { aiGeneratedId } = req.params;
      const userId = req.user.id;

      // Get AI record to verify ownership and check type
      const aiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
      if (!aiRecord) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch trình AI'
        });
      }

      // Verify ownership
      if (aiRecord.user_id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xóa lịch trình này'
        });
      }

      // Delete associated ITINERARIES records
      const deleteResult = await Itinerary.deleteMany({
        origin_id: aiGeneratedId
      });

      // Delete AI_GENERATED_ITINERARIES record
      await AiGeneratedItinerary.findByIdAndDelete(aiGeneratedId);

      console.log(`✅ Deleted AI itinerary ${aiGeneratedId} and ${deleteResult.deletedCount} associated day records`);

      res.json({
        success: true,
        message: 'Xóa lịch trình thành công',
        data: {
          deletedAiRecord: aiGeneratedId,
          deletedDayRecords: deleteResult.deletedCount
        }
      });

    } catch (error) {
      console.error('❌ Error deleting itinerary:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa lịch trình',
        error: error.message
      });
    }
  }
};

module.exports = aiItineraryController;