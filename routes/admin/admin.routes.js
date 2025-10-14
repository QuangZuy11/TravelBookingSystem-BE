const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const { checkAdminRole } = require('../../middlewares/admin.middleware');
const adminController = require('../../controllers/admin/admin.controller');

// Áp dụng middleware cho tất cả các route trong file này
router.use(authMiddleware, checkAdminRole);

// @route   GET /api/admin/dashboard/stats
router.get('/dashboard/stats', adminController.getDashboardStats);

// @route   GET /api/admin/users
router.get('/users', adminController.getAllUsers);

// @route   PUT /api/admin/users/:id
router.put('/users/:id', adminController.updateUser);

// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;