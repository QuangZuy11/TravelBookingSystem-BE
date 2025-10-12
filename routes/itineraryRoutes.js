const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/service-provider/tour/itineraryController');

// ===== ITINERARY MANAGEMENT =====

/**
 * Create itinerary for a tour
 * POST /api/itineraries
 * Body: { tour_id, day_number, title, description, meals, accommodation, transportation }
 */
router.post('/', itineraryController.createItinerary);

/**
 * Get all itineraries for a tour
 * GET /api/itineraries/tour/:tourId
 */
router.get('/tour/:tourId', itineraryController.getTourItineraries);

/**
 * Get single itinerary by ID
 * GET /api/itineraries/:id
 */
router.get('/:id', itineraryController.getItineraryById);

/**
 * Update itinerary
 * PUT /api/itineraries/:id
 */
router.put('/:id', itineraryController.updateItinerary);

/**
 * Delete itinerary
 * DELETE /api/itineraries/:id
 */
router.delete('/:id', itineraryController.deleteItinerary);

// ===== ACTIVITIES MANAGEMENT =====

/**
 * Add activity to itinerary
 * POST /api/itineraries/:itineraryId/activities
 * Body: { poi_id, destination_id, activity_name, start_time, end_time, duration_hours, description, cost, included_in_tour, optional, notes }
 */
router.post('/:itineraryId/activities', itineraryController.addActivity);

/**
 * Get all activities of an itinerary
 * GET /api/itineraries/:itineraryId/activities
 */
router.get('/:itineraryId/activities', itineraryController.getActivities);

/**
 * Get single activity
 * GET /api/itineraries/:itineraryId/activities/:activityId
 */
router.get('/:itineraryId/activities/:activityId', itineraryController.getActivityById);

/**
 * Update activity
 * PUT /api/itineraries/:itineraryId/activities/:activityId
 */
router.put('/:itineraryId/activities/:activityId', itineraryController.updateActivity);

/**
 * Delete activity
 * DELETE /api/itineraries/:itineraryId/activities/:activityId
 */
router.delete('/:itineraryId/activities/:activityId', itineraryController.deleteActivity);

/**
 * Reorder activities in an itinerary
 * PUT /api/itineraries/:itineraryId/activities/reorder
 * Body: { activityIds: [id1, id2, id3...] }
 */
router.put('/:itineraryId/activities/reorder', itineraryController.reorderActivities);

module.exports = router;
