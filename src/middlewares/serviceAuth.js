// Authentification inter-services par clé partagée X-Service-Key
const crypto = require('crypto');
const env = require('../config/env');

// Vérifie la clé X-Service-Key pour les appels entre microservices
function serviceAuth(req, res, next) {
  const key = req.headers['x-service-key'];
  if (!key) return res.status(401).json({ error: 'Header X-Service-Key manquant' });

  // Comparaison en temps constant pour éviter les attaques par timing
  const hashA = crypto.createHash('sha256').update(String(key)).digest();
  const hashB = crypto.createHash('sha256').update(String(env.INTER_SERVICE_KEY)).digest();

  if (!crypto.timingSafeEqual(hashA, hashB)) {
    return res.status(403).json({ error: 'Clé de service invalide' });
  }

  req.isService = true;
  next();
}

module.exports = { serviceAuth };
