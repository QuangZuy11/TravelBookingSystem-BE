const express = require('express');
const router = express.Router();
const aiCtrl = require('../controllers/aiItinerary.controller');

// Create a request
router.post('/requests', aiCtrl.createRequest);

// Generate itinerary from a stored request
router.post('/generate/:requestId', aiCtrl.generateItineraryFromRequest);

// Direct generate from payload (no prior request)
router.post('/generate', aiCtrl.generateFromPayload);

// Get all itineraries for a user
router.get('/user/:userId', aiCtrl.getUserItineraries);

// Get all requests for a user
router.get('/requests/user/:userId', aiCtrl.getUserRequests);

// Get a specific itinerary by ID
router.get('/:itineraryId', aiCtrl.getItineraryById);

// Delete an itinerary
router.delete('/:itineraryId', aiCtrl.deleteItinerary);

// ===== EDIT ENDPOINTS =====

// Update itinerary day (title, description)
router.put('/day/:itineraryDayId', aiCtrl.updateItineraryDay);

// Update an activity
router.put('/activity/:activityId', aiCtrl.updateActivity);

// Add new activity to a day
router.post('/day/:itineraryDayId/activities', aiCtrl.addActivity);

// Delete an activity
router.delete('/activity/:activityId', aiCtrl.deleteActivity);

// Reorder activities in a day
router.put('/day/:itineraryDayId/reorder', aiCtrl.reorderActivities);

module.exports = router;
