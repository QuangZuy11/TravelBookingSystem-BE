const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/auth.middleware');
const { checkAdminRole } = require('../../middlewares/admin.middleware');
const {
  listPromotionTermsPolicies,
  createPromotionTermsPolicy,
  getPromotionTermsPolicyDetail,
  updatePromotionTermsPolicy,
  deletePromotionTermsPolicy,
} = require('../../controllers/termsPolicy.controller');

router.use(requireAuth, checkAdminRole);

router.get('/', listPromotionTermsPolicies);
router.post('/', createPromotionTermsPolicy);
router.get('/:id', getPromotionTermsPolicyDetail);
router.put('/:id', updatePromotionTermsPolicy);
router.delete('/:id', deletePromotionTermsPolicy);

module.exports = router;
