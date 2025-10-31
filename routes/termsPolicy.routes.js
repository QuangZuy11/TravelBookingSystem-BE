const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/auth.middleware');
const {
  getTermsPolicies,
  getCurrentUserTermsPolicies,
} = require('../controllers/termsPolicy.controller');

// Public endpoint: allows filtering by role via query params
router.get('/', getTermsPolicies);

// Authenticated endpoint: returns policies for the logged-in user's role
router.get('/me', requireAuth, getCurrentUserTermsPolicies);

module.exports = router;
