const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { messageLimiter } = require('../middlewares/rateLimiter');
const ctrl = require('../controllers/message.controller');

const router = Router();

router.use(authenticate);
router.use(messageLimiter);

router.get('/inbox', ctrl.getInbox);
router.get('/unread/count', ctrl.getUnreadCount);
router.get('/thread/:threadCode', ctrl.getThread);
router.put('/:messageId/read', ctrl.markAsRead);
router.post('/:adId', ctrl.sendMessage);
router.get('/:adId', ctrl.getAdMessages);

module.exports = router;
