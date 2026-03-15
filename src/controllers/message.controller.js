const messageService = require('../services/message.service');
const { broadcastToUser } = require('../websocket/wsServer');
const notificationsClient = require('../services/notificationsClient');

async function sendMessage(req, res, next) {
  try {
    const { content } = req.body;
    const message = await messageService.sendMessage(req.user.id, req.params.adId, content);
    // Diffusion temps réel au destinataire via WebSocket
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

async function getAdMessages(req, res, next) {
  try {
    const result = await messageService.getAdMessages(req.user.id, req.params.adId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getThread(req, res, next) {
  try {
    const result = await messageService.getThread(req.user.id, req.params.threadCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const result = await messageService.markAsRead(req.user.id, req.params.messageId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const result = await messageService.getUnreadCount(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function countMessagesForAd(req, res, next) {
  try {
    const result = await messageService.countMessagesForAd(req.params.adId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function softDeleteAdMessages(req, res, next) {
  try {
    const result = await messageService.softDeleteAdMessages(req.params.adId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function adminStartConversation(req, res, next) {
  try {
    const content = req.body?.content;
    const result = await messageService.adminStartConversation(req.user.id, req.params.userId, content);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

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
