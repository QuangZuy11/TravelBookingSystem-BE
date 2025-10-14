const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const { checkAdminRole } = require('../../middlewares/admin.middleware');
const adminController = require('../../controllers/admin/admin.controller');

// Áp dụng middleware cho tất cả các route trong file này
router.use(authMiddleware, checkAdminRole);

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

// User Management
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.get('/users/stats', adminController.getUserStats); 
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/ban', adminController.banUser);
router.put('/users/:id/password', adminController.changeUserPassword);

module.exports = router;