// Contrôle d'accès réservé aux rôles admin et assistance
const { ForbiddenError } = require('../utils/errors');

// Réservé aux administrateurs
function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ForbiddenError('Accès réservé aux administrateurs'));
  }
  next();
}

// Réservé aux admins et à l'équipe assistance (messagerie support)
function requireAdminOrAssistance(req, _res, next) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'assistance') {
    return next(new ForbiddenError('Accès réservé aux administrateurs et à l\'assistance'));
  }
  next();
}

module.exports = { requireAdmin, requireAdminOrAssistance };
