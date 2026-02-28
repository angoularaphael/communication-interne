require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const { connectMongo } = require('./src/config/mongodb');
const { attachWebSocket } = require('./src/websocket/wsServer');
const env = require('./src/config/env');

async function start() {
  try {
    await connectMongo();

    const server = http.createServer(app);
    attachWebSocket(server);

    server.listen(env.PORT, () => {
      console.log(`[Messaging Service] Démarré sur le port ${env.PORT} (HTTP + WebSocket /ws)`);
    });
  } catch (err) {
    console.error('[Messaging Service] Erreur au démarrage:', err.message);
    process.exit(1);
  }
}

start();
