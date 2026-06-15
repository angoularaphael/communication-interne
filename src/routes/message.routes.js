// Routes publiques messagerie sous /api/v1/messages (proxifiées par Auth-service)
const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { requireAdminOrAssistance } = require('../middlewares/adminAuth');
const { messageLimiter } = require('../middlewares/rateLimiter');
const ctrl = require('../controllers/message.controller');

const router = Router();

router.use(authenticate);
router.use(messageLimiter);

router.get('/inbox', ctrl.getInbox);
router.get('/unread/count', ctrl.getUnreadCount);
router.get('/thread/:threadCode', ctrl.getThread);
router.put('/:messageId/read', ctrl.markAsRead);
router.post('/thread/:threadCode/send', ctrl.sendMessageInThread);
router.post('/:adId', ctrl.sendMessage);
router.get('/:adId', ctrl.getAdMessages);

// Sous-routes support admin et assistance
const adminRouter = Router();
adminRouter.use(requireAdminOrAssistance);
adminRouter.post('/start/:userId', ctrl.adminStartConversation);
adminRouter.post('/send/:userId', ctrl.adminSendMessage);
adminRouter.post('/broadcast', ctrl.adminBroadcast);

router.use('/admin', adminRouter);

module.exports = router;
