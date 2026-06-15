// Variables d'environnement du service communication (port 3006, MongoDB, auth, products)

// Avertit au démarrage si une variable obligatoire manque
const requiredVars = ['MONGO_URI', 'MONGO_DB_NAME', 'AUTH_SERVICE_URL', 'INTER_SERVICE_KEY'];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`[env] Variable manquante: ${key}`);
  }
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3006,
  NODE_ENV: process.env.NODE_ENV || 'development',

  MONGO_URI: process.env.MONGO_URI,
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'danebcys',

  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  PRODUCTS_SERVICE_URL: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3004',
  // Conservé pour compatibilité ; les notifications sont gérées en local depuis la fusion 2026-06
  NOTIFICATIONS_SERVICE_URL: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3010',
  INTER_SERVICE_KEY: process.env.INTER_SERVICE_KEY,

  // Fenêtre de rate limiting par défaut : 15 minutes
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
};
