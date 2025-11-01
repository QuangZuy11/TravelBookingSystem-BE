const AiItineraryRequest = require('../models/ai_itinerary_request.model');
const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
const Itinerary = require('../models/itinerary.model');
// const ItineraryActivity = require('../models/itinerary-activity.model'); // Removed - activities are now simple array
const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');
const Tour = require('../models/tour.model');
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
    // Expect payload: { user_id, destination, destination_id (optional), start_date, end_date, duration_days, participant_number, age_range, budget_level, preferences }

    // If destination_id not provided, try to find it by destination name
    if (!payload.destination_id && payload.destination) {
      const destination = await Destination.findOne({ name: new RegExp('^' + payload.destination + '$', 'i') });
      if (destination) {
        payload.destination_id = destination._id;
      }
    }

    const request = new AiItineraryRequest(payload);
    await request.save();

    res.status(201).json({ success: true, message: 'AI itinerary request created', data: request });
  } catch (err) {
    console.error('Error creating AI request', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

exports.generateItineraryFromRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await AiItineraryRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

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

      try {
        // Get all available destinations from DB
        const availableDestinations = await Destination.find({}).limit(50);

        if (availableDestinations.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No destinations available in database'
          });
        }

        // Ask AI to suggest best destination
        const suggestion = await aiService.generateDestinationSuggestion({
          request,
          availableDestinations
        });


        // Save AI suggestion
        request.ai_suggested_destination = suggestion.suggested_destination_name;
        request.ai_suggested_destination_id = suggestion.suggested_destination_id;
        await request.save();

        // Use suggested destination
        destination = await Destination.findById(suggestion.suggested_destination_id);
        destinationName = suggestion.suggested_destination_name;

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
        } else {
          return res.status(400).json({
            success: false,
            message: 'Cannot determine destination and AI service unavailable'
          });
        }
      }
    }
    // CASE 2: User specified destination
    else {

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


    // Try to call AI service to generate structured plan
    let aiPlan = null;
    try {
      aiPlan = await aiService.generateItinerary({ request, destination, pois, days });
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
      message: 'Itinerary generated',
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

    const itinerary = await Itinerary.findById(itineraryDayId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary day not found'
      });
    }

    // Update fields
    if (title !== undefined) itinerary.title = title;
    if (description !== undefined) itinerary.description = description;

    await itinerary.save();

    res.status(200).json({
      success: true,
      message: 'Itinerary day updated',
      data: itinerary
    });
  } catch (err) {
    console.error('Error updating itinerary day', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Update an activity
exports.updateActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const updateData = req.body; // { activity_name, start_time, end_time, duration_hours, description, cost, optional }

    const activity = await ItineraryActivity.findById(activityId);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['activity_name', 'start_time', 'end_time', 'duration_hours', 'description', 'cost', 'optional'];
    let fieldsUpdated = [];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        activity[field] = updateData[field];
        fieldsUpdated.push(field);
      }
    });


    // Save changes
    const savedActivity = await activity.save();

    // Populate POI data if exists
    await savedActivity.populate('poi_id');

    res.status(200).json({
      success: true,
      message: 'Activity updated successfully',
      data: savedActivity
    });
  } catch (err) {
    console.error('❌ Error updating activity', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Add new activity to a day
exports.addActivity = async (req, res) => {
  try {
    const { itineraryDayId } = req.params;
    const activityData = req.body; // { poi_id, activity_name, start_time, end_time, duration_hours, description, cost, optional }

    const itinerary = await Itinerary.findById(itineraryDayId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary day not found'
      });
    }

    // Create new activity
    const newActivity = new ItineraryActivity({
      itinerary_id: itinerary._id,
      poi_id: activityData.poi_id || null,
      activity_name: activityData.activity_name,
      start_time: activityData.start_time || '09:00',
      end_time: activityData.end_time || '11:00',
      duration_hours: activityData.duration_hours || 2,
      description: activityData.description || '',
      cost: activityData.cost || 0,
      optional: activityData.optional || false
    });

    await newActivity.save();

    // Add to itinerary's activities array
    itinerary.activities.push(newActivity._id);
    await itinerary.save();

    res.status(201).json({
      success: true,
      message: 'Activity added',
      data: newActivity
    });
  } catch (err) {
    console.error('Error adding activity', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Delete an activity
exports.deleteActivity = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await ItineraryActivity.findById(activityId);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    const itineraryId = activity.itinerary_id;

    // Remove from itinerary's activities array
    await Itinerary.findByIdAndUpdate(
      itineraryId,
      { $pull: { activities: activityId } }
    );

    // Delete the activity
    await ItineraryActivity.findByIdAndDelete(activityId);

    res.status(200).json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting activity', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Reorder activities in a day and recalculate times
exports.reorderActivities = async (req, res) => {
  try {
    const { itineraryDayId } = req.params;
    const { activityIds } = req.body; // Array of activity IDs in new order

    const itinerary = await Itinerary.findById(itineraryDayId);

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary day not found'
      });
    }

    // Validate all activity IDs belong to this itinerary
    const validIds = activityIds.filter(id =>
      itinerary.activities.some(actId => String(actId) === String(id))
    );

    if (validIds.length !== activityIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some activity IDs do not belong to this itinerary day'
      });
    }

    // Update order
    itinerary.activities = activityIds;
    await itinerary.save();

    // Recalculate times for all activities based on new order

    const DAY_START_HOUR = 8;
    const TRAVEL_TIME_MINUTES = 30;
    let currentTime = `${DAY_START_HOUR.toString().padStart(2, '0')}:00`;

    for (let i = 0; i < activityIds.length; i++) {
      const activityId = activityIds[i];
      const activity = await ItineraryActivity.findById(activityId).populate('poi_id');

      if (!activity) {
        continue;
      }

      // Get duration from POI or use activity's duration
      let durationMinutes = 0;
      if (activity.poi_id && activity.poi_id.recommendedDuration) {
        const { hours = 0, minutes = 0 } = activity.poi_id.recommendedDuration;
        durationMinutes = hours * 60 + minutes;
      } else {
        // Fallback to activity's duration_hours
        durationMinutes = (activity.duration_hours || 2) * 60;
      }

      // Set start time
      activity.start_time = currentTime;

      // Calculate end time
      const endTime = addMinutesToTime(currentTime, durationMinutes);
      activity.end_time = endTime;
      activity.duration_hours = durationMinutes / 60;

      await activity.save();

      // Calculate next start time (add travel time if not last activity)
      if (i < activityIds.length - 1) {
        currentTime = addMinutesToTime(endTime, TRAVEL_TIME_MINUTES);
      }
    }

    // Fetch updated activities to return
    const updatedActivities = await ItineraryActivity.find({ _id: { $in: activityIds } })
      .populate('poi_id');

    // Sort by order
    const activitiesMap = {};
    updatedActivities.forEach(act => {
      activitiesMap[act._id.toString()] = act;
    });
    const sortedActivities = activityIds.map(id => activitiesMap[id.toString()]).filter(Boolean);

    res.status(200).json({
      success: true,
      message: 'Activities reordered and times recalculated',
      data: {
        itinerary: itinerary,
        activities: sortedActivities
      }
    });
  } catch (err) {
    console.error('❌ Error reordering activities', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
