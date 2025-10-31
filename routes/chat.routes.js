const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const auth = require('../middlewares/auth.middleware');

router.post('/session', auth, chatController.createSession);
router.post('/message', auth, chatController.postMessage);
router.get('/history/:sessionId', auth, chatController.getHistory);

module.exports = router;