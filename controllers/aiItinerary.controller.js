const AiItineraryRequest = require('../models/ai_itinerary_request.model');
const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
const Itinerary = require('../models/itinerary.model');
const ItineraryActivity = require('../models/itinerary-activity.model');
const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');
const Tour = require('../models/tour.model');
const aiService = require('../services/ai.service');

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
    // Expect payload: { user_id, destination, start_date, end_date, duration_days, participant_number, age_range, budget_level, preferences }

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

    console.log(`🛰️ Generating itinerary for request ${requestId} -> destination=${request.destination}`);

    // Mark processing
    request.status = 'processing';
    await request.save();

    // Find destination
    const destination = await Destination.findOne({ destination_name: new RegExp('^' + request.destination + '$', 'i') });
  console.log('🛰️ Destination lookup result:', destination ? destination._id : 'none');

    // Fetch POIs for destination, order by rating
    let pois = [];
    if (destination) {
      pois = await PointOfInterest.find({ destination_id: destination._id }).sort({ rating: -1 }).limit(20);
    } else {
      // Fallback: search POIs by destination string in name or categories
      pois = await PointOfInterest.find({
        $or: [
          { poi_name: new RegExp(request.destination, 'i') },
          { categories: new RegExp(request.destination, 'i') }
        ]
      }).sort({ rating: -1 }).limit(20);
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

    // Partition POIs into days
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
          const act = new ItineraryActivity({
            itinerary_id: itObj._id,
            poi_id: poi ? poi._id : null,
            activity_name: a.activity_name || (poi ? poi.poi_name : 'Activity'),
            start_time: a.start_time || '09:00',
            end_time: a.end_time || '11:00',
            duration_hours: a.duration_hours || 2,
            description: a.description || (poi ? poi.description : ''),
            cost: a.cost || 0,
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
      // Fallback heuristic partition POIs into days
      const dayPicks = [];
      for (let d = 0; d < days; d++) dayPicks.push([]);
      for (let i = 0; i < pois.length; i++) {
        dayPicks[i % days].push(pois[i]);
      }

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

        // Create activities for this day
        const activities = [];
        const picks = dayPicks[d] || [];

        // Schedule activities roughly from 09:00 onwards
        let hour = 9;
        for (const poi of picks) {
          const start_time = `${String(hour).padStart(2, '0')}:00`;
          const end_time = `${String(hour + 2).padStart(2, '0')}:00`;

          const act = new ItineraryActivity({
            itinerary_id: itObj._id,
            poi_id: poi._id,
            activity_name: poi.poi_name,
            start_time,
            end_time,
            duration_hours: 2,
            description: poi.description || '',
            cost: poi.price || 0,
            optional: false
          });

          await act.save();
          activities.push(act);
          itObj.activities.push(act._id);

          hour += 3; // next activity later in day
        }

        await itObj.save();
        createdItineraries.push({ itinerary: itObj, activities });
      }
    }

    // Save AI Generated record
    const aiGen = new AiGeneratedItinerary({
      request_id: request._id,
      tour_id: tour ? tour._id : null,
      provider_id: tour ? tour.provider_id : null,
      itinerary_data: createdItineraries,
      summary: `Generated ${createdItineraries.length} itinerary days for ${request.destination}`
    });
    await aiGen.save();

    // Update request
    request.status = 'completed';
    request.ai_response = { generated_id: aiGen._id };
    await request.save();

    res.status(200).json({ success: true, message: 'Itinerary generated', data: aiGen });
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
