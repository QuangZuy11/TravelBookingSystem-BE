const Itinerary = require('../models/itinerary.model');
const AiItineraryRequest = require('../models/ai_itinerary_request.model');
const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
const aiService = require('../services/ai.service');
const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');
const Tour = require('../models/tour.model');
const mongoose = require('mongoose');

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

// Get time slot based on time string
const getTimeSlot = (timeStr) => {
  const hour = parseInt(timeStr.split(':')[0]);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
};

// Parse day number which may come as a number or a localized string like "Ngày 1"
const parseDayNumber = (val) => {
  if (val === undefined || val === null) return 1;
  if (typeof val === 'number') return val;
  const s = String(val);
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
};

// Normalize incoming activities but preserve client-provided subdocument _id and activityId when possible
const preserveNormalizeActivities = (incomingActivities, itineraryType) => {
  if (!incomingActivities || !Array.isArray(incomingActivities)) return [];

  // First, let the model generate a normalized version (fills defaults, parses duration)
  const normalized = Itinerary.normalizeActivities(incomingActivities, itineraryType);

  // Try to preserve provided _id / id and activityId by matching activityId or provided _id
  for (const n of normalized) {
    const match = incomingActivities.find(a => {
      if (!a) return false;
      if (a.activityId && n.activityId && String(a.activityId) === String(n.activityId)) return true;
      if (a._id && String(a._id) === String(n._id)) return true;
      if (a.id && String(a.id) === String(n._id)) return true;
      return false;
    });

    if (match) {
      // Preserve client-provided embedded document id if it's a valid ObjectId
      // If it's not a valid ObjectId (e.g. custom client id like 'activity_1_2'),
      // do NOT assign it to the MongoDB _id field; instead preserve it as activityId.
      try {
        if (match._id && mongoose.Types.ObjectId.isValid(String(match._id))) {
          n._id = match._id;
        } else if (match.id && mongoose.Types.ObjectId.isValid(String(match.id))) {
          n._id = match.id;
        } else {
          // If the client provided a non-ObjectId identifier, keep it as activityId
          if (match._id && !mongoose.Types.ObjectId.isValid(String(match._id))) n.activityId = String(match._id);
          if (match.id && !mongoose.Types.ObjectId.isValid(String(match.id))) n.activityId = String(match.id);
        }
      } catch (err) {
        // Fallback: don't assign invalid _id
        if (match.activityId) n.activityId = match.activityId;
      }
      // Preserve activityId if client provided a custom value
      if (match.activityId) n.activityId = match.activityId;
      // Preserve userModified flags
      if (match.userModified !== undefined) n.userModified = match.userModified;
      if (match.user_modified !== undefined) n.userModified = match.user_modified;
    }
  }

  return normalized;
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

    // Try to match destination if provided
    if (payload.destination) {
      const destination = await Destination.findOne({ destination_name: new RegExp('^' + payload.destination + '$', 'i') });
      console.log(`📍 Found matching destination: ${destination?.destination_name || 'none'}`);
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

    // Mark processing
    request.status = 'processing';
    await request.save();

    let destination = null;
    let destinationName = request.destination;

    // CASE 1: User doesn't know where to go - AI suggests destination
    if (!request.destination) {

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
        await request.save();

        // Use suggested destination
        destination = await Destination.findById(suggestion.suggested_destination_id);
        destinationName = suggestion.suggested_destination_name;

        console.log('✅ Using AI suggested destination:', destinationName);
      } catch (aiErr) {
        console.warn('⚠️ AI destination suggestion failed:', aiErr.message);

        // Fallback: Smart destination suggestion based on preferences
        try {
          let fallbackDest = null;

          // 1. Try to match based on preferences
          if (request.preferences && request.preferences.length > 0) {
            const preferenceMatch = await Destination.find({
              $or: request.preferences.map(pref => ({
                $or: [
                  { popular_activities: new RegExp(pref, 'i') },
                  { description: new RegExp(pref, 'i') }
                ]
              }))
            }).sort({ 'ratings.average': -1 }).limit(1);

            if (preferenceMatch && preferenceMatch.length > 0) {
              fallbackDest = preferenceMatch[0];
            }
          }

          // 2. If no preference match, try budget level
          if (!fallbackDest && request.budget_level) {
            const budgetQuery = {};
            if (request.budget_level === 'high') {
              budgetQuery['price_level'] = { $in: ['high', 'luxury'] };
            } else if (request.budget_level === 'low') {
              budgetQuery['price_level'] = { $in: ['low', 'budget'] };
            }

            const budgetMatch = await Destination.findOne(budgetQuery)
              .sort({ 'ratings.average': -1 });

            if (budgetMatch) {
              fallbackDest = budgetMatch;
            }
          }

          // 3. Last resort: most popular destination
          if (!fallbackDest) {
            fallbackDest = await Destination.findOne({})
              .sort({ 'ratings.average': -1 });
          }

          if (fallbackDest) {
            destination = fallbackDest;
            destinationName = fallbackDest.destination_name;
            request.ai_suggested_destination = fallbackDest.destination_name;

            // Add suggestion reason based on match type
            request.ai_response = {
              suggestion_reason: request.preferences && request.preferences.length > 0
                ? `Điểm đến được đề xuất dựa trên sở thích: ${request.preferences.join(', ')}`
                : request.budget_level
                  ? `Điểm đến phù hợp với ngân sách ${request.budget_level === 'high' ? 'cao cấp' : request.budget_level === 'low' ? 'tiết kiệm' : 'trung bình'}`
                  : 'Điểm đến phổ biến được nhiều du khách đánh giá cao'
            };

            await request.save();
            console.log('🔄 Smart fallback to destination:', destinationName);
          } else {
            return res.status(400).json({
              success: false,
              message: 'Không thể xác định điểm đến phù hợp trong cơ sở dữ liệu'
            });
          }
        } catch (fallbackErr) {
          console.error('Fallback suggestion failed:', fallbackErr);
          return res.status(400).json({
            success: false,
            message: 'Không thể xác định điểm đến và dịch vụ AI không khả dụng'
          });
        }
      }
    }
    // CASE 2: User specified destination
    else {

      // Find destination by destination_name
      destination = await Destination.findOne({ destination_name: new RegExp('^' + request.destination + '$', 'i') });

      // Update request destination name if needed
      if (destination && request.destination !== destination.destination_name) {
        request.destination = destination.destination_name;
        await request.save();
      }

      destinationName = destination?.destination_name || request.destination;
    }

    console.log('🛰️ Final destination:', destinationName, '| ID:', destination?._id);

    // Fetch POIs for all destinations, order by rating (sử dụng 'destinationId' theo POI model)
    let pois = [];
    const destinationNames = (request.destination || destinationName).split(',').map(d => d.trim());

    // Get destinations from database
    const destinations = await Promise.all(
      destinationNames.map(name =>
        Destination.findOne({ destination_name: new RegExp('^' + name + '$', 'i') })
      )
    );

    // Fetch POIs for each destination
    for (const dest of destinations.filter(d => d)) {
      // ✅ Smart POI filtering based on budget level
      let query = { destinationId: dest._id };

      console.log(`🔍 POI Query for ${dest.destination_name}:`);
      console.log(`   Budget Level: ${request.budget_level || 'not set'}`);
      console.log(`   Budget Total: ${request.budget_total || 0} VND`);

      // Filter by entry fee based on budget level
      if (request.budget_level === 'high' || request.budget_total >= 10000000) {
        // High budget: prioritize premium POIs (entry fee >= 1M VND)
        query['entryFee.adult'] = { $gte: 1000000 };
        console.log(`   Filter: PREMIUM (>= 1M VND)`);
      } else if (request.budget_level === 'low' || (request.budget_total > 0 && request.budget_total < 3000000)) {
        // Low budget: only free or cheap POIs (entry fee < 500K VND)
        query['entryFee.adult'] = { $lt: 500000 };
        console.log(`   Filter: BUDGET (< 500K VND)`);
      } else {
        console.log(`   Filter: ALL POIs (no budget filter)`);
      }
      // Medium budget: no filter (all POIs)

      let destPois = await PointOfInterest.find(query)
        .sort({ 'entryFee.adult': -1, 'ratings.average': -1 }) // ✅ Sort by price first, then rating
        .limit(15);

      console.log(`   Found: ${destPois.length} POIs`);
      if (destPois.length > 0) {
        console.log(`   Top 3 POIs:`);
        destPois.slice(0, 3).forEach((poi, i) => {
          console.log(`     ${i + 1}. ${poi.name} - ${(poi.entryFee?.adult || 0).toLocaleString()} VND`);
        });
      }

      // If no premium POIs found for high budget, fall back to all POIs
      if (destPois.length === 0 && (request.budget_level === 'high' || request.budget_total >= 10000000)) {
        console.log('⚠️  No premium POIs found, falling back to all POIs');
        destPois = await PointOfInterest.find({ destinationId: dest._id })
          .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
          .limit(15);
        console.log(`   Fallback found: ${destPois.length} POIs`);
      }

      // Add destination name to each POI
      destPois.forEach(poi => {
        poi.destinationName = dest.destination_name;
      });

      pois = pois.concat(destPois);
    }

    // If no POIs found through destination IDs, try fallback with name search
    if (pois.length === 0) {
      for (const name of destinationNames) {
        // ✅ Apply same budget-based filtering in fallback
        let fallbackQuery = { name: new RegExp(name, 'i') };

        if (request.budget_level === 'high' || request.budget_total >= 10000000) {
          fallbackQuery['entryFee.adult'] = { $gte: 1000000 };
        } else if (request.budget_level === 'low' || (request.budget_total > 0 && request.budget_total < 3000000)) {
          fallbackQuery['entryFee.adult'] = { $lt: 500000 };
        }

        const fallbackPois = await PointOfInterest.find(fallbackQuery)
          .sort({ 'entryFee.adult': -1, 'ratings.average': -1 })
          .limit(15);

        fallbackPois.forEach(poi => {
          poi.destinationName = name;
        });

        pois = pois.concat(fallbackPois);
      }
    }
    console.log('🛰️ Found POIs:', pois.length, '| Budget level:', request.budget_level || 'medium');

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

    // Create a placeholder ObjectId to use as origin_id for itineraries.
    // We avoid saving an incomplete AiGeneratedItinerary (which would fail validation)
    // and instead create/save the AiGeneratedItinerary after the day documents are built.
    const placeholderId = new mongoose.Types.ObjectId();
    let aiGenRecord = null; // will be created after itineraries exist

    if (aiPlan && Array.isArray(aiPlan.days) && aiPlan.days.length > 0) {
      // Create from AI plan
      for (const day of aiPlan.days) {
        const dayNumber = parseDayNumber(day.day_number || day.dayNumber);
        const itObj = new Itinerary({
          origin_id: placeholderId,
          type: 'ai_gen',
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

          const activityData = {
            activity: a.activity_name || (poi ? poi.name : 'Activity'),
            location: poi ? poi.location?.address || '' : '',
            duration: durationHours * 60, // Convert to minutes for embedded model
            cost: a.cost || (poi ? poi.entryFee?.adult : 0) || 0,
            activityType: Itinerary.mapActivityType(a.type || 'other'),
            timeSlot: getTimeSlot(a.start_time || '09:00')
          };

          itObj.activities.push(activityData);
          activities.push(activityData);
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

      // Create itineraries for each day
      for (let d = 0; d < days; d++) {
        const dayNumber = d + 1;
        const title = `Day ${dayNumber} - ${request.destination}`;
        const itObj = new Itinerary({
          origin_id: placeholderId,
          type: 'ai_gen',
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

          const activityData = {
            activity: poi.name,
            location: poi.location?.address || '',
            duration: durationMinutes,
            cost: poi.entryFee?.adult || 0,
            activityType: poi.type || 'sightseeing',
            timeSlot: getTimeSlot(start_time)
          };

          itObj.activities.push(activityData);
          activities.push(activityData);

          // Next activity starts after current activity + travel time (30 minutes)
          currentTime = addMinutesToTime(end_time, TRAVEL_TIME_MINUTES);
        }

        await itObj.save();
        createdItineraries.push({ itinerary: itObj, activities });
      }
    }

    // Create and save the final AiGeneratedItinerary using the placeholderId
    aiGenRecord = new AiGeneratedItinerary({
      _id: placeholderId,
      request_id: request._id,
      user_id: request.user_id || (req.user && req.user.id) || null,
      destination: destinationName || request.destination || '',

      duration_days: days || request.duration_days || 0,
      budget_total: request.budget_total || 0,
      participant_number: request.participant_number || 1,
      preferences: request.preferences || [],
      tour_id: tour ? tour._id : null,
      provider_id: tour ? tour.provider_id : null,
      itinerary_data: createdItineraries,
      summary: destination
        ? `Generated ${createdItineraries.length} itinerary days for ${destination.destination_name}`
        : `Generated ${createdItineraries.length} itinerary days for ${destinationName || 'destination'}`,
      status: 'done'
    });

    await aiGenRecord.save();

    // Update request
    request.status = 'completed';
    request.ai_response = {
      generated_id: aiGenRecord._id,
      destination_used: destinationName,
      ai_suggested: !!request.ai_suggested_destination
    };
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Đã tạo lịch trình thành công',
      data: aiGenRecord,
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
    const { aiGeneratedId } = req.params;
    console.log(`🛰️ Fetching itinerary ${aiGeneratedId}`);

    const itinerary = await AiGeneratedItinerary.findById(aiGeneratedId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Re-query activities from DB to get latest data (not rely on possibly stale itinerary_data)
    let itineraryDataWithLatest = [];

    if (itinerary.status === 'custom') {
      // For customized records, ignore stored itinerary_data (may be stale) and fetch
      // the actual customized Itinerary documents that reference this AI record via origin_id.
      const customizedDays = await Itinerary.find({ origin_id: itinerary._id, type: 'customized' }).sort({ day_number: 1 });

      for (const itineraryDay of customizedDays) {
        const activities = itineraryDay.activities || [];
        for (const activity of activities) {
          if (activity.poi_id) {
            const poi = await PointOfInterest.findById(activity.poi_id);
            activity.poi_details = poi;
          }
        }

        itineraryDataWithLatest.push({ itinerary: itineraryDay, activities });
      }
    } else {
      // Original AI-generated record: use stored itinerary_data to locate days (supports both
      // embedded itinerary object or simple id reference)
      for (const dayData of itinerary.itinerary_data || []) {
        const refId = dayData?.itinerary?._id || dayData?.itinerary || null;
        if (!refId) continue;

        const itineraryDay = await Itinerary.findById(refId);
        if (!itineraryDay) continue;

        const activities = itineraryDay.activities || [];
        for (const activity of activities) {
          if (activity.poi_id) {
            const poi = await PointOfInterest.findById(activity.poi_id);
            activity.poi_details = poi;
          }
        }

        itineraryDataWithLatest.push({ itinerary: itineraryDay, activities });
      }
    }

    const response = {
      _id: itinerary._id,
      request_id: itinerary.request_id,
      user_id: itinerary.user_id,
      destination: itinerary.destination,

      duration_days: itinerary.duration_days,
      budget_total: itinerary.budget_total,
      participant_number: itinerary.participant_number,
      preferences: itinerary.preferences,
      tour_id: itinerary.tour_id,
      provider_id: itinerary.provider_id,
      summary: itinerary.summary,
      status: itinerary.status,
      created_at: itinerary.created_at,
      updated_at: itinerary.updated_at,
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
    const { aiGeneratedId } = req.params;
    console.log(`🛰️ Deleting itinerary ${aiGeneratedId}`);

    const itinerary = await AiGeneratedItinerary.findById(aiGeneratedId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Delete associated itinerary records (activities are embedded, so no separate deletion needed)
    const itineraryIds = itinerary.itinerary_data.map(d => d.itinerary._id);
    await Itinerary.deleteMany({ _id: { $in: itineraryIds } });

    // Delete the generated itinerary record
    await AiGeneratedItinerary.findByIdAndDelete(aiGeneratedId);

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
        message: 'Không tìm thấy lịch trình',
        error: 'Itinerary not found'
      });
    }

    // Update fields if provided
    if (title) itinerary.title = title;
    if (description) itinerary.description = description;

    await itinerary.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật lịch trình thành công',
      data: itinerary
    });
  } catch (err) {
    console.error('Error updating itinerary day', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật lịch trình',
      error: err.message
    });
  }
};

// Unified customize endpoint - handles both initialization, retrieval, and UPDATE
exports.customizeItinerary = async (req, res) => {
  try {
    const { aiGeneratedId } = req.params;
    const hasUpdateData = req.body && Object.keys(req.body).length > 0;
    // Track if we initialize a customized record in this request and map original->customized day IDs
    let initializedIdMap = null;
    let justInitialized = false;

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

          let dayToUpdate = await Itinerary.findById(dayUpdate.dayId);

          // If the client sent an original AI dayId (origin_id = original AI record)
          // but the request is targeting the customized AI record (aiGeneratedId),
          // try to map the original day to the corresponding customized day by day_number.
          if (dayToUpdate && dayToUpdate.origin_id.toString() !== aiGeneratedId) {
            try {
              const mapped = await Itinerary.findOne({ origin_id: aiGeneratedId, day_number: dayToUpdate.day_number, type: 'customized' });
              if (mapped) {
                console.log('🔁 Mapped original day to customized day:', { from: dayToUpdate._id.toString(), to: mapped._id.toString() });
                dayToUpdate = mapped;
              }
            } catch (mapErr) {
              console.warn('⚠️ Error mapping original day to customized day', mapErr.message);
            }
          }

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
              const validation = Itinerary.validateActivities(dayUpdate.activities, 'ai_gen');
              if (!validation.valid) {
                throw new Error(`Activities validation failed: ${validation.error}`);
              }

              // ✅ UNIFIED NORMALIZATION: Use schema static method but preserve client IDs
              const normalizedActivities = preserveNormalizeActivities(dayUpdate.activities, 'ai_gen');

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
      const idMap = {};
      for (const originalDay of originalDays) {
        const customizedDay = Itinerary.createCustomizedCopy(originalDay);
        customizedDay.origin_id = customizedAiRecord._id; // Point to new customized AI record
        customizedDay.type = 'customized';
        await customizedDay.save();
        customizedDays.push(customizedDay);

        // Record mapping from original day id -> new customized day id
        try {
          idMap[originalDay._id.toString()] = customizedDay._id.toString();
        } catch (mapErr) {
          // fallback: use string conversion
          idMap[String(originalDay._id)] = String(customizedDay._id);
        }
      }

      initializedIdMap = idMap;
      justInitialized = true;

      // Update the customized AI record to reference the newly created customized day documents
      try {
        customizedAiRecord.itinerary_data = customizedDays.map(d => ({ itinerary: d, activities: d.activities }));
        await customizedAiRecord.save();
      } catch (saveMapErr) {
        console.warn('⚠️ Could not attach cloned days to customized AI record:', saveMapErr.message);
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

          // ✅ UNIFIED ACTIVITIES HANDLING: Use schema static methods and preserve client IDs
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
            const normalizedActivities = preserveNormalizeActivities(dayUpdate.activities, dayToUpdate.type);
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
        // If we just initialized a customized version in this request, return a mapping
        // so the frontend can replace original day IDs with the customized ones.
        id_map: justInitialized ? initializedIdMap : undefined,
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
};// Get AI itinerary details (alias for getItineraryById)
exports.getItineraryDetails = exports.getItineraryById;

// Get original AI itinerary (type='ai_gen')
exports.getOriginalItinerary = async (req, res) => {
  try {
    const { aiGeneratedId } = req.params;

    // Find original AI record
    const aiRecord = await AiGeneratedItinerary.findOne({
      _id: aiGeneratedId,
      status: { $ne: 'custom' }
    });

    if (!aiRecord) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình AI gốc'
      });
    }

    // Get original days
    const originalDays = await Itinerary.find({
      origin_id: aiGeneratedId,
      type: 'ai_gen'
    }).sort({ day_number: 1 });

    res.json({
      success: true,
      message: 'Lấy lịch trình gốc thành công',
      data: {
        aiGeneratedId: aiGeneratedId,
        isOriginal: true,
        isCustomizable: false,
        days: originalDays
      }
    });
  } catch (error) {
    console.error('❌ Error getting original itinerary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch trình gốc',
      error: error.message
    });
  }
};

// Check/Get customizable version (alias for customizeItinerary GET)
exports.getCustomizableItinerary = exports.customizeItinerary;

// Initialize customization (alias for customizeItinerary POST)
exports.initializeCustomization = exports.customizeItinerary;

// Delete AI itinerary (both AI record and associated day records)
exports.deleteAiItinerary = async (req, res) => {
  try {
    const { aiGeneratedId } = req.params;
    const userId = req.user?.id;

    // Get AI record to verify ownership and check type
    const aiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
    if (!aiRecord) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình AI'
      });
    }

    // Verify ownership (if user authentication is available)
    if (userId && aiRecord.user_id && aiRecord.user_id.toString() !== userId) {
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
};

/**
 * ✅ Get itinerary with booking availability info
 * GET /api/ai-itineraries/:id/booking-info
 */
exports.getItineraryBookingInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const ServiceProvider = require('../models/service-provider.model');

    // Get itinerary with preferred providers
    const itinerary = await AiGeneratedItinerary.findById(id)
      .populate('preferred_providers', 'company_name rating email phone booking_stats');

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch trình AI'
      });
    }

    // Check if bookable
    const isBookable = itinerary.isAvailableForBooking();

    // Get available tour providers for this destination
    const availableProviders = await ServiceProvider.find({
      type: 'tour',
      admin_verified: true,
      'booking_settings.available_destinations': {
        $regex: new RegExp(itinerary.destination, 'i')
      }
    })
      .select('company_name rating email phone booking_stats.approval_rate booking_stats.completed_bookings booking_settings.response_time_hours')
      .limit(10)
      .sort({ rating: -1 });

    res.json({
      success: true,
      data: {
        itinerary_id: itinerary._id,
        destination: itinerary.destination,
        duration_days: itinerary.duration_days,
        participant_number: itinerary.participant_number,
        is_bookable: isBookable,
        estimated_price_range: itinerary.estimated_price_range,
        available_providers: availableProviders.map(p => ({
          _id: p._id,
          company_name: p.company_name,
          rating: p.rating,
          approval_rate: p.booking_stats?.approval_rate || 0,
          completed_bookings: p.booking_stats?.completed_bookings || 0,
          response_time_hours: p.booking_settings?.response_time_hours || 48
        })),
        booking_count: itinerary.booking_count,
        total_bookings: itinerary.total_bookings
      }
    });
  } catch (error) {
    console.error('❌ Error getting booking info:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};