const express = require('express');
const router = express.Router();
const promotionController = require('../../controllers/traveler/promotion.controller');

router.get('/', promotionController.getActivePromotions);

module.exports = router;
