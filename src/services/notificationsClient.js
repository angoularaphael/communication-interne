// Façade locale : persistance MongoDB + push WebSocket (fusion notifications 2026-06)
const notificationService = require('./notification.service');
const { broadcastToUser } = require('../websocket/wsServer');

// Crée une notification et l'envoie en temps réel au client WebSocket
async function createNotification(userId, type, message) {
  const notification = await notificationService.createNotification(userId, type, message);
  broadcastToUser(userId, { type: 'new_notification', notification });
  return { created: true, notification };
}

// Prévient qu'un nouveau message est arrivé (sans bloquer si ça échoue)
function notifyNewMessage(receiverId) {
  createNotification(
    receiverId,
    'new_message',
    'Vous avez reçu un nouveau message'
  ).catch((err) => console.error('[notificationsClient] Nouveau message:', err.message));
}

module.exports = { createNotification, notifyNewMessage };
