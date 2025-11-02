const express = require('express');
const router = express.Router();
const fastAICtrl = require('../controllers/fastAI.controller');

// Fast itinerary generation - optimized for speed
router.post('/generate-fast', fastAICtrl.generateFastItinerary);

// Simple text itinerary (no complex JSON)
router.post('/generate-text', fastAICtrl.generateTextItinerary);

// Test AI connection
router.get('/test', fastAICtrl.testAI);

module.exports = router;