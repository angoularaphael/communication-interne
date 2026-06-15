// Point d'entrée : HTTP Express + WebSocket sur le port 3006
// Point d'entrée HTTP + WebSocket — messages, notifications et temps réel (port 3006)
require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { connectMongo } = require('./src/config/mongodb');
const { attachWebSocket } = require('./src/websocket/wsServer');
const env = require('./src/config/env');

// Connecte MongoDB puis démarre le serveur HTTP avec WebSocket sur /ws
async function start() {
  try {
    await connectMongo();

    const server = http.createServer(app);
    attachWebSocket(server);

    server.listen(env.PORT, () => {
      console.log(`[Communication Service] Démarré sur le port ${env.PORT} (HTTP + WebSocket /ws)`);
    });
  } catch (err) {
    console.error('[Communication Service] Erreur au démarrage:', err.message);
    process.exit(1);
  }
}

start();
