const express = require('express');
const router = express.Router();
const serviceProviderAuthController = require('../controllers/auth/serviceProviderAuthController');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Register Service Provider Business (Đăng ký kinh doanh)
 * POST /api/auth/service-provider/register
 * Headers: Authorization: Bearer <token>
 * Body: { company_name, contact_person, address, type: [], licenses: [] }
 */
router.post('/register', authMiddleware, serviceProviderAuthController.createProviderProfile);

/**
 * Get Service Provider Profile
 * GET /api/auth/service-provider/profile
 */
router.get('/profile', authMiddleware, serviceProviderAuthController.getServiceProviderProfile);

/**
 * Update Service Provider Profile
 * PUT /api/auth/service-provider/profile
 */
router.put('/profile', authMiddleware, serviceProviderAuthController.updateServiceProviderProfile);

module.exports = router;
