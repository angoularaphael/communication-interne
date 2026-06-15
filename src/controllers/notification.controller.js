// Handlers HTTP pour les notifications in-app
const notificationService = require('../services/notification.service');

// GET /api/v1/notifications — liste des notifications de l'utilisateur
async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const data = await notificationService.listNotifications(req.user.id, {
      page,
      limit,
      userRole: req.user?.role
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/notifications/:id/read — marque une notification comme lue
async function markAsRead(req, res, next) {
  try {
    const ok = await notificationService.markAsRead(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Notification non trouvée' });
    res.json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/notifications/read-all — tout marquer comme lu
async function markAllAsRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/notifications/unread/count — nombre de notifications non lues
async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user.id, req.user?.role);
    res.json({ unreadCount: count });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markAsRead, markAllAsRead, getUnreadCount };
