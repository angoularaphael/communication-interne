const { ForbiddenError } = require('../utils/errors');

function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ForbiddenError('Accès réservé aux administrateurs'));
  }
  next();
}

/** Admin ou Assistance peuvent envoyer des messages aux utilisateurs. */
function requireAdminOrAssistance(req, _res, next) {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'assistance') {
    return next(new ForbiddenError('Accès réservé aux administrateurs et à l\'assistance'));
  }
  next();
}

module.exports = { requireAdmin, requireAdminOrAssistance };
