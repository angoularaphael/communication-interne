// Routes internes /internal — appelées par Auth, Orders, Users avec X-Service-Key
const { Router } = require('express');
const { serviceAuth } = require('../middlewares/serviceAuth');
const messageCtrl = require('../controllers/message.controller');
const notificationService = require('../services/notification.service');
const { broadcastToUser } = require('../websocket/wsServer');
const { BadRequestError } = require('../utils/errors');

const router = Router();

router.use(serviceAuth);

router.get('/messages/ad/:adId/count', messageCtrl.countMessagesForAd);
router.delete('/messages/ad/:adId', messageCtrl.softDeleteAdMessages);

// POST /internal/notifications — crée une notif et la pousse en WebSocket
router.post('/notifications', async (req, res, next) => {
  try {
    const { userId, type, message } = req.body;
    if (!userId || !type || !message) {
      throw new BadRequestError('userId, type et message requis');
    }
    const notification = await notificationService.createNotification(userId, type, message);
    broadcastToUser(userId, {
      type: 'new_notification',
      notification
    });
    res.status(201).json({ created: true, notification });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
