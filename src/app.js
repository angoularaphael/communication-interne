// Application Express : messagerie, notifications et routes internes (port 3006)
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const messageRoutes = require('./routes/message.routes');
const notificationRoutes = require('./routes/notification.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Récupère l'IP du client depuis les en-têtes proxy (passés par Auth-service)
app.use((req, _res, next) => {
  req.clientIp = req.headers['x-client-ip'] || req.headers['x-forwarded-for'] || req.ip;
  next();
});

app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/notifications', notificationRoutes);
// Appels inter-services protégés par X-Service-Key
app.use('/internal', internalRoutes);

// Healthcheck pour Docker et le monitoring
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'communication-service' });
});

// Renvoie les erreurs en JSON ; la stack en mode développement
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
