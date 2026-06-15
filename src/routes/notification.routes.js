// Routes publiques notifications sous /api/v1/notifications
const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { notificationLimiter } = require('../middlewares/rateLimiter');
const ctrl = require('../controllers/notification.controller');

const router = Router();

router.use(authenticate);
router.use(notificationLimiter);

router.get('/', ctrl.list);
router.get('/unread/count', ctrl.getUnreadCount);
router.put('/read-all', ctrl.markAllAsRead);
router.put('/:id/read', ctrl.markAsRead);

module.exports = router;
