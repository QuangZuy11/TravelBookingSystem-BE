const express = require('express');
const router = express.Router();
const aiCtrl = require('../controllers/aiItinerary.controller');

// Create a request
router.post('/requests', aiCtrl.createRequest);

// Generate itinerary from a stored request
router.post('/generate/:requestId', aiCtrl.generateItineraryFromRequest);

// Direct generate from payload (no prior request)
router.post('/generate', aiCtrl.generateFromPayload);

module.exports = router;
