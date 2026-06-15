/**
 * Tests d'intégration de notification.service (logique migrée depuis l'ancien
 * Notifications-service vers Communication-service).
 *
 * On mocke la connexion Mongo via une fausse collection in-memory.
 *
 * Exécuter : npm test
 */

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeCollection } = require('./helpers/fakeMongoCollection');

const fakeCol = createFakeCollection();
const mongodbConfigPath = path.resolve(__dirname, '..', 'src', 'config', 'mongodb.js');
require.cache[mongodbConfigPath] = {
  id: mongodbConfigPath,
  filename: mongodbConfigPath,
  loaded: true,
  exports: {
    getDb: () => ({ collection: () => fakeCol }),
    connectMongo: async () => {},
    closeMongo: async () => {}
  }
};

const notificationService = require('../src/services/notification.service');

const USER_A = 'user-aaaa';
const USER_B = 'user-bbbb';

test.beforeEach(() => {
  fakeCol._reset();
});

test('createNotification insère un document non lu, non supprimé', async () => {
  const created = await notificationService.createNotification(USER_A, 'order_paid', 'Commande payée');
  assert.equal(created.userId, USER_A);
  assert.equal(created.type, 'order_paid');
  assert.equal(created.message, 'Commande payée');
  assert.equal(created.isRead, false);
  assert.ok(created.createdAt instanceof Date);
  assert.ok(created.id);
});

test('listNotifications renvoie les notifications de l\'utilisateur, triées récent → ancien', async () => {
  const n1 = await notificationService.createNotification(USER_A, 'a', 'msg1');
  await new Promise((r) => setTimeout(r, 5));
  const n2 = await notificationService.createNotification(USER_A, 'b', 'msg2');
  await notificationService.createNotification(USER_B, 'c', 'autre user');

  const res = await notificationService.listNotifications(USER_A, { page: 1, limit: 10 });
  assert.equal(res.notifications.length, 2);
  assert.equal(res.notifications[0].id, n2.id, 'le plus récent en premier');
  assert.equal(res.notifications[1].id, n1.id);
  assert.equal(res.pagination.total, 2);
});

test('getUnreadCount renvoie 0 quand tout est lu', async () => {
  await notificationService.createNotification(USER_A, 'a', 'm');
  await notificationService.createNotification(USER_A, 'b', 'm');
  assert.equal(await notificationService.getUnreadCount(USER_A), 2);
  await notificationService.markAllAsRead(USER_A);
  assert.equal(await notificationService.getUnreadCount(USER_A), 0);
});

test('markAllAsRead n\'affecte que l\'utilisateur ciblé', async () => {
  await notificationService.createNotification(USER_A, 'a', 'm');
  await notificationService.createNotification(USER_B, 'b', 'm');

  await notificationService.markAllAsRead(USER_A);

  assert.equal(await notificationService.getUnreadCount(USER_A), 0);
  assert.equal(await notificationService.getUnreadCount(USER_B), 1);
});

test('markAsRead marque une notification précise', async () => {
  const created = await notificationService.createNotification(USER_A, 'a', 'msg');
  const ok = await notificationService.markAsRead(USER_A, created.id);
  assert.equal(ok, true);
  assert.equal(await notificationService.getUnreadCount(USER_A), 0);
});

test('markAsRead refuse une notification appartenant à un autre user', async () => {
  const created = await notificationService.createNotification(USER_A, 'a', 'msg');
  const ok = await notificationService.markAsRead(USER_B, created.id);
  assert.equal(ok, false);
  assert.equal(await notificationService.getUnreadCount(USER_A), 1);
});

test('listNotifications applique la pagination', async () => {
  for (let i = 0; i < 5; i++) {
    await notificationService.createNotification(USER_A, 'spam', `n${i}`);
  }
  const page1 = await notificationService.listNotifications(USER_A, { page: 1, limit: 2 });
  const page3 = await notificationService.listNotifications(USER_A, { page: 3, limit: 2 });

  assert.equal(page1.notifications.length, 2);
  assert.equal(page3.notifications.length, 1);
  assert.equal(page1.pagination.total, 5);
  assert.equal(page1.pagination.pages, 3);
});
