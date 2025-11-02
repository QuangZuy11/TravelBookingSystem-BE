const express = require('express');
const router = express.Router();
const aiItineraryController = require('../controllers/aiItinerary.controller');
const finalDayController = require('../controllers/finalDay.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateObjectId } = require('../middlewares/validateObjectId.middleware');

// Apply authentication to all routes
router.use(authMiddleware);

// List all AI itineraries for a user
router.get('/user/:userId', aiItineraryController.getUserItineraries);

// Generate AI itinerary → AI_GENERATED_ITINERARIES → ITINERARIES (origin_id = AI_GENERATED_ITINERARIES._id, type = ai_gen)
router.post('/generate', aiItineraryController.generateFromPayload);

// Get AI itinerary details (general endpoint for frontend)
router.get('/:aiGeneratedId', validateObjectId('aiGeneratedId'), aiItineraryController.getItineraryDetails);

// View original AI itinerary (type='ai_gen')
router.get('/:aiGeneratedId/original', aiItineraryController.getOriginalItinerary);

// Check/Get customizable version (type='customized')
router.get('/:aiGeneratedId/customize', aiItineraryController.getCustomizableItinerary);

// Initialize customization (clone ai_gen → customized with same origin_id)
router.post('/:aiGeneratedId/initialize-customize', aiItineraryController.initializeCustomization);

// Unified customize endpoint - handles both initialization and retrieval (for frontend)
router.put('/:aiGeneratedId/customize', validateObjectId('aiGeneratedId'), aiItineraryController.customizeItinerary);

// Delete AI itinerary (both AI record and associated day records)
router.delete('/:aiGeneratedId', validateObjectId('aiGeneratedId'), aiItineraryController.deleteItinerary);

// Day-level operations (only work on type='customized' records)
router.put('/:aiGeneratedId/days/:dayNumber', finalDayController.updateDay);

// Activity operations within customized days
router.post('/:aiGeneratedId/days/:dayNumber/activities', finalDayController.addActivity);
router.put('/:aiGeneratedId/days/:dayNumber/activities/:activityId', finalDayController.updateActivity);
router.delete('/:aiGeneratedId/days/:dayNumber/activities/:activityId', finalDayController.deleteActivity);

// Reorder activities within a day
router.put('/:aiGeneratedId/days/:dayNumber/reorder', finalDayController.reorderActivities);

module.exports = router;