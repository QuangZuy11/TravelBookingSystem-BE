const express = require('express');
const router = express.Router();
const serviceProviderController = require('../controllers/serviceProviderController');

// Service Provider routes
router.get('/providers/:providerId', serviceProviderController.getProviderProfile);
router.put('/providers/:providerId', serviceProviderController.updateProviderProfile);
router.get('/providers/:providerId/statistics', serviceProviderController.getProviderStatistics);
router.post('/providers/:providerId/documents', serviceProviderController.uploadDocuments);
router.get('/providers/:providerId/processes', serviceProviderController.getServiceProcesses);

module.exports = router;