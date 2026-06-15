// Rate limiter en mémoire par utilisateur (messages et notifications)
const env = require('../config/env');

// Compte les requêtes par utilisateur en mémoire
const store = new Map();

// Nettoie les compteurs expirés toutes les 60 secondes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

// Limite le nombre de requêtes par fenêtre de temps
function createLimiter({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ error: 'Trop de requêtes, réessayez plus tard' });
    }

    next();
  };
}

const messageLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  keyFn: (req) => req.user ? `user:${req.user.id}` : null
});

const notificationLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  keyFn: (req) => req.user ? `user:${req.user.id}` : null
});

module.exports = { createLimiter, messageLimiter, notificationLimiter };
