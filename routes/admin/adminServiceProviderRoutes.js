const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const adminController = require('../../controllers/admin/adminServiceProviderController');

// Tất cả routes cần auth + admin role
// TODO: Add admin role check middleware

/**
 * Get pending providers
 * GET /api/admin/service-providers/pending
 */
router.get('/pending', authMiddleware, adminController.getPendingProviders);

/**
 * Get service provider by ID
 * GET /api/admin/service-providers/:id
 */
router.get('/:id', authMiddleware, adminController.getServiceProviderById);

/**
 * Admin approve/reject provider
 * PUT /api/admin/service-providers/:id/verify-admin
 * Body: { approved: true/false, rejection_reason: "..." }
 */
router.put('/:id/verify-admin', authMiddleware, adminController.updateAdminVerification);

/**
 * Admin verify/reject license
 * PUT /api/admin/service-providers/:id/verify-license
 * Body: { license_id: "...", status: "verified/rejected", rejection_reason: "..." }
 */
router.put('/:id/verify-license', authMiddleware, adminController.updateLicenseVerification);

module.exports = router;
