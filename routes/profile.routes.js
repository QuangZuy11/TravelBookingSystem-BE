const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { getMe ,updateMe ,changePassword} = require('../controllers/profile.controller');

// @route   GET /api/profiles/me
// @access  Private
router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);
router.put("/change-password", auth, changePassword);


module.exports = router;
