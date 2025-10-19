const express = require('express');
const router = express.Router();
const Destination = require('../models/destination.model');

/**
 * @route   GET /api/destinations
 * @desc    Get all destinations with optional filters
 * @access  Public
 * @query   country - Filter by country name
 * @query   search - Search by destination name (partial match)
 * @query   limit - Limit number of results (default: 50)
 */
router.get('/', async (req, res) => {
    try {
        const { country, search, limit = 50 } = req.query;

        let query = {};

        // Filter by country
        if (country) {
            query['location.country'] = new RegExp(country, 'i');
        }

        // Search by name (partial match, case-insensitive)
        if (search) {
            query.name = new RegExp(search, 'i');
        }

        const destinations = await Destination.find(query)
            .limit(parseInt(limit))
            .sort({ name: 1 });

        return res.json({
            success: true,
            message: `Found ${destinations.length} destinations`,
            data: destinations
        });

    } catch (error) {
        console.error('Error fetching destinations:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching destinations',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/destinations/:destinationId
 * @desc    Get single destination by ID
 * @access  Public
 */
router.get('/:destinationId', async (req, res) => {
    try {
        const { destinationId } = req.params;

        const destination = await Destination.findById(destinationId);

        if (!destination) {
            return res.status(404).json({
                success: false,
                message: 'Destination not found'
            });
        }

        return res.json({
            success: true,
            data: destination
        });

    } catch (error) {
        console.error('Error fetching destination:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching destination',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/destinations/search/:name
 * @desc    Search destinations by name (partial match)
 * @access  Public
 */
router.get('/search/:name', async (req, res) => {
    try {
        const { name } = req.params;

        const destinations = await Destination.find({
            name: new RegExp(name, 'i')
        }).limit(20);

        return res.json({
            success: true,
            message: `Found ${destinations.length} destinations matching "${name}"`,
            data: destinations
        });

    } catch (error) {
        console.error('Error searching destinations:', error);
        return res.status(500).json({
            success: false,
            message: 'Error searching destinations',
            error: error.message
        });
    }
});

module.exports = router;
