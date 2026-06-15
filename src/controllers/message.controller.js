// Handlers HTTP pour la messagerie acheteur/vendeur et le support admin
const messageService = require('../services/message.service');
const { broadcastToUser } = require('../websocket/wsServer');
const notificationsClient = require('../services/notificationsClient');

// POST /api/v1/messages/:adId — envoie un message lié à une annonce
async function sendMessage(req, res, next) {
  try {
    const { content } = req.body;
    const message = await messageService.sendMessage(req.user.id, req.params.adId, content);
    // Pousse le message en temps réel au destinataire connecté
    broadcastToUser(message.receiver_id, {
      type: 'new_message',
      message: {
        messageId: message.messageId,
        ad_id: message.ad_id,
        thread_code: message.thread_code,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: message.content,
        is_read: message.is_read,
        created_at: message.created_at
      }
    });
    notificationsClient.notifyNewMessage(message.receiver_id);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/messages/inbox — fils de conversation de l'utilisateur
async function getInbox(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await messageService.getInbox(req.user.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/messages/:adId — messages d'une annonce
async function getAdMessages(req, res, next) {
  try {
    const result = await messageService.getAdMessages(req.user.id, req.params.adId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/messages/thread/:threadCode — tous les messages d'un fil
async function getThread(req, res, next) {
  try {
    const result = await messageService.getThread(req.user.id, req.params.threadCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/messages/:messageId/read — marque un message comme lu
async function markAsRead(req, res, next) {
  try {
    const result = await messageService.markAsRead(req.user.id, req.params.messageId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/messages/unread/count — messages non lus
async function getUnreadCount(req, res, next) {
  try {
    const result = await messageService.getUnreadCount(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /internal/messages/ad/:adId/count — nombre de messages (autres services)
async function countMessagesForAd(req, res, next) {
  try {
    const result = await messageService.countMessagesForAd(req.params.adId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// DELETE /internal/messages/ad/:adId — supprime les messages d'une annonce (logique)
async function softDeleteAdMessages(req, res, next) {
  try {
    const result = await messageService.softDeleteAdMessages(req.params.adId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/messages/admin/start/:userId — démarre une conversation support
async function adminStartConversation(req, res, next) {
  try {
    const content = req.body?.content;
    const result = await messageService.adminStartConversation(req.user.id, req.params.userId, content);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/messages/admin/send/:userId — message support vers un utilisateur
async function adminSendMessage(req, res, next) {
  try {
    const { content } = req.body;
    const message = await messageService.adminSendMessage(req.user.id, req.params.userId, content);
    broadcastToUser(message.receiver_id, {
      type: 'new_message',
      message: {
        messageId: message.messageId,
        ad_id: message.ad_id,
        thread_code: message.thread_code,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: message.content,
        is_read: message.is_read,
        created_at: message.created_at
      }
    });
    notificationsClient.notifyNewMessage(message.receiver_id);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/messages/thread/:threadCode/send — envoie dans un fil existant
async function sendMessageInThread(req, res, next) {
  try {
    const { content } = req.body;
    const message = await messageService.sendMessageInThread(req.user.id, req.params.threadCode, content);
    broadcastToUser(message.receiver_id, {
      type: 'new_message',
      message: {
        messageId: message.messageId,
        ad_id: message.ad_id,
        thread_code: message.thread_code,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        content: message.content,
        is_read: message.is_read,
        created_at: message.created_at
      }
    });
    notificationsClient.notifyNewMessage(message.receiver_id);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/messages/admin/broadcast — message support à plusieurs utilisateurs
async function adminBroadcast(req, res, next) {
  try {
    const { userIds, content } = req.body;
    const result = await messageService.adminBroadcast(req.user.id, userIds || [], content);
    for (const r of result.results) {
      if (r.message) {
        broadcastToUser(r.userId, {
          type: 'new_message',
          message: {
            messageId: r.message.messageId,
            ad_id: r.message.ad_id,
            thread_code: r.message.thread_code,
            sender_id: r.message.sender_id,
            receiver_id: r.message.receiver_id,
            content: r.message.content,
            is_read: r.message.is_read,
            created_at: r.message.created_at
          }
        });
        notificationsClient.notifyNewMessage(r.userId);
      }
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendMessage,
  getInbox,
  getAdMessages,
  getThread,
  markAsRead,
  getUnreadCount,
  countMessagesForAd,
  softDeleteAdMessages,
  adminStartConversation,
  adminSendMessage,
  sendMessageInThread,
  adminBroadcast
};
