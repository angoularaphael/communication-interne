const { WebSocketServer } = require('ws');
const authClient = require('../services/authClient');

/** Map userId -> Set<WebSocket> */
const userSockets = new Map();

/**
 * Attache le serveur WebSocket au serveur HTTP.
 * Route : ws://host:port/ws?token=ACCESS_TOKEN
 */
function attachWebSocket(server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/ws'
  });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    authClient
      .validateToken(token)
      .then((result) => {
        if (!result.valid || !result.user?.id) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request, result.user);
        });
      })
      .catch(() => {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      });
  });

  wss.on('connection', (ws, _req, user) => {
    const userId = user.id;

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(ws);

    ws.userId = userId;

    ws.on('close', () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) userSockets.delete(userId);
      }
    });

    ws.on('error', () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) userSockets.delete(userId);
      }
    });
  });

  return wss;
}

/**
 * Envoie un payload à tous les WebSockets connectés d'un utilisateur.
 * Utilisé quand un nouveau message est reçu (destinataire = userId).
 */
function broadcastToUser(userId, payload) {
  const set = userSockets.get(userId);
  if (!set) return;

  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }
}

module.exports = { attachWebSocket, broadcastToUser };
