const http = require('http');
const https = require('https');
const env = require('../config/env');

/**
 * Crée une notification pour un utilisateur (ex: "nouveau message" pour le destinataire).
 * N'interrompt pas en cas d'échec (fire-and-forget).
 */
function createNotification(userId, type, message) {
  return new Promise((resolve, reject) => {
    const baseUrl = env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3010';
    const url = new URL(baseUrl + '/internal/notifications');
    const transport = url.protocol === 'https:' ? https : http;

    const body = JSON.stringify({ userId, type, message });

    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Service-Key': env.INTER_SERVICE_KEY || ''
      }
    };

    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          try {
            const parsed = JSON.parse(data);
            return reject(new Error(parsed.error || 'Notifications Service error'));
          } catch (_e) {
            return reject(new Error('Notifications Service error'));
          }
        }
        resolve({ created: true });
      });
    });

    req.on('error', (e) => reject(new Error(`Notifications: ${e.message}`)));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Envoie une notification "nouveau message" au destinataire. Ne bloque pas la réponse HTTP.
 */
function notifyNewMessage(receiverId) {
  createNotification(
    receiverId,
    'new_message',
    'Vous avez reçu un nouveau message'
  ).catch((err) => console.error('[notificationsClient] Nouveau message:', err.message));
}

module.exports = { createNotification, notifyNewMessage };
