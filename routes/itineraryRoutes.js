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

// ===== ACTIVITIES ARE NOW SIMPLE ARRAY =====
// Activities are now managed directly within itinerary as { time, action } array
// No separate activity endpoints needed - use PUT /api/itineraries/:id to update activities array

module.exports = router;
