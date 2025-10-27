const express = require('express');
const router = express.Router();
const promotionController = require('../../controllers/service-provider/promotionController');
const authMiddleware = require('../../middlewares/auth.middleware');
const { requireAnyVerifiedLicense } = require('../../middlewares/providerVerification.middleware');

router.use(authMiddleware, requireAnyVerifiedLicense);

router.post('/', promotionController.createPromotion);
router.get('/', promotionController.getMyPromotions);

module.exports = router;
