const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Image Proxy Endpoint
 * Bypasses CORS restrictions for Google Drive and other image sources
 * 
 * Usage: GET /api/image-proxy?url=IMAGE_URL
 */
router.get('/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;

        // Validate URL parameter
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        // Validate URL format
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }

        console.log('[Image Proxy] 🖼️ Fetching:', url);

        // Fetch image from source
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://drive.google.com/'
            },
            timeout: 15000, // 15 seconds timeout
            maxRedirects: 5,
            maxContentLength: 10 * 1024 * 1024, // Max 10MB
            maxBodyLength: 10 * 1024 * 1024
        });

        // Determine content type
        const contentType = response.headers['content-type'] || 'image/jpeg';

        // Set CORS headers to allow frontend access
        res.set({
            'Content-Type': contentType,
            'Content-Length': response.headers['content-length'],
            'Cache-Control': 'public, max-age=86400', // Cache for 1 day
            'Access-Control-Allow-Origin': '*', // Allow all origins
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'X-Proxy-Cache': 'HIT' // For debugging
        });

        // Send image data
        res.send(Buffer.from(response.data));

        console.log(`[Image Proxy] ✅ Success (${contentType}, ${response.headers['content-length']} bytes)`);

    } catch (error) {
        console.error('[Image Proxy] ❌ Error:', error.message);

        // Handle different error types
        if (error.response) {
            // Source returned error response
            const status = error.response.status;
            res.status(status).json({
                success: false,
                error: `Failed to fetch image: ${status}`,
                details: error.message,
                sourceUrl: req.query.url
            });
        } else if (error.code === 'ECONNABORTED') {
            // Timeout
            res.status(504).json({
                success: false,
                error: 'Request timeout',
                details: 'Image source took too long to respond'
            });
        } else {
            // Other errors (network, etc.)
            res.status(500).json({
                success: false,
                error: 'Failed to proxy image',
                details: error.message
            });
        }
    }
});

/**
 * OPTIONS endpoint for CORS preflight
 */
router.options('/image-proxy', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    });
    res.sendStatus(204);
});

/**
 * Health check endpoint for the proxy service
 */
router.get('/image-proxy/health', (req, res) => {
    res.json({
        success: true,
        message: 'Image proxy service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
