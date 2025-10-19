const express = require('express');
const router = express.Router();
const PointOfInterest = require('../models/point-of-interest.model');
const Destination = require('../models/destination.model');

/**
 * @route   GET /api/poi/destination/:destinationId
 * @desc    Get all POIs for a specific destination
 * @access  Public (or add auth middleware if needed)
 */
router.get('/destination/:destinationId', async (req, res) => {
    try {
        const { destinationId } = req.params;
        const { type, status = 'active' } = req.query;

        console.log(`📍 Fetching POIs for destination: ${destinationId}`);

        // Build query
        const query = {
            destinationId,
            status
        };

        // Filter by type if provided
        if (type) {
            query.type = type;
        }

        // Fetch POIs
        const pois = await PointOfInterest.find(query)
            .populate('destinationId', 'name country')
            .sort({ 'ratings.average': -1, name: 1 }); // Sort by rating desc, then name asc

        res.status(200).json({
            success: true,
            message: `Found ${pois.length} POIs`,
            data: pois
        });
    } catch (err) {
        console.error('Error fetching POIs:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/poi/:poiId
 * @desc    Get single POI by ID
 * @access  Public
 */
router.get('/:poiId', async (req, res) => {
    try {
        const { poiId } = req.params;

        const poi = await PointOfInterest.findById(poiId)
            .populate('destinationId', 'name country description');

        if (!poi) {
            return res.status(404).json({
                success: false,
                message: 'POI not found'
            });
        }

        res.status(200).json({
            success: true,
            data: poi
        });
    } catch (err) {
        console.error('Error fetching POI:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/poi
 * @desc    Get all POIs with optional filters
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const { type, status = 'active', limit = 50 } = req.query;

        const query = { status };
        if (type) query.type = type;

        const pois = await PointOfInterest.find(query)
            .populate('destinationId', 'name country')
            .limit(parseInt(limit))
            .sort({ 'ratings.average': -1 });

        res.status(200).json({
            success: true,
            message: `Found ${pois.length} POIs`,
            data: pois
        });
    } catch (err) {
        console.error('Error fetching POIs:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
});

module.exports = router;
