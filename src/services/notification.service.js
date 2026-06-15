// Logique métier notifications in-app — persistance MongoDB et filtrage par rôle
const { getDb } = require('../config/mongodb');

function col() {
  return getDb().collection('notifications');
}

// Types visibles uniquement par les administrateurs (alertes système, modération)
const ADMIN_ONLY_TYPES = [
  'activité_frauduleuse',
  'payment_pending',
  'subscription_pending',
  'student_proof_pending',
  'order_shipped'
];

// Liste les notifications d'un utilisateur (masque les types admin pour les non-admins)
async function listNotifications(userId, { page = 1, limit = 20, userRole } = {}) {
  const skip = (page - 1) * limit;
  const filter = { user_id: userId, deleted: false };
  if (userRole && userRole !== 'admin') {
    filter.type = { $nin: ADMIN_ONLY_TYPES };
  }

  const [results, total] = await Promise.all([
    col().find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
    col().countDocuments(filter)
  ]);

  return {
    notifications: results.map(formatNotification),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function markAsRead(userId, notificationId) {
  const { ObjectId } = require('mongodb');
  const result = await col().updateOne(
    { _id: new ObjectId(notificationId), user_id: userId, deleted: false },
    { $set: { is_read: true } }
  );
  return result.modifiedCount > 0;
}

async function markAllAsRead(userId) {
  await col().updateMany(
    { user_id: userId, is_read: false, deleted: false },
    { $set: { is_read: true } }
  );
}

// Compte les non lues avec le même filtre admin que listNotifications
async function getUnreadCount(userId, userRole) {
  const filter = { user_id: userId, is_read: false, deleted: false };
  if (userRole && userRole !== 'admin') {
    filter.type = { $nin: ADMIN_ONLY_TYPES };
  }
  return col().countDocuments(filter);
}

// Crée une notification en base (appelée par routes internes et messages)
async function createNotification(userId, type, message) {
  const doc = {
    user_id: userId,
    type,
    message,
    is_read: false,
    deleted: false,
    created_at: new Date()
  };
  const result = await col().insertOne(doc);
  doc._id = result.insertedId;
  return formatNotification(doc);
}

// Normalise un document MongoDB vers le format API (camelCase)
function formatNotification(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.user_id,
    type: doc.type,
    message: doc.message,
    isRead: doc.is_read,
    createdAt: doc.created_at
  };
}

module.exports = { listNotifications, markAsRead, markAllAsRead, getUnreadCount, createNotification };
