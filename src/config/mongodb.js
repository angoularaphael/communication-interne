// Connexion MongoDB et index des collections messages + notifications
const { MongoClient } = require('mongodb');
const env = require('./env');

// Client MongoDB unique pour tout le service
let client = null;
let db = null;

// Se connecte à MongoDB et crée les index si besoin
async function connectMongo() {
  if (db) return db;

  client = new MongoClient(env.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000
  });

  await client.connect();
  db = client.db(env.MONGO_DB_NAME);

  await ensureIndexes();

  console.log('[mongodb] Connecté à', env.MONGO_DB_NAME);
  return db;
}

// Index pour les requêtes inbox, fils de conversation et comptage par annonce
async function ensureIndexes() {
  const messages = db.collection('messages');
  await messages.createIndex({ thread_code: 1, created_at: 1 });
  await messages.createIndex({ ad_id: 1, deleted: 1 });
  await messages.createIndex({ sender_id: 1, deleted: 1 });
  await messages.createIndex({ receiver_id: 1, is_read: 1, deleted: 1 });
  await messages.createIndex({ ad_id: 1, sender_id: 1, receiver_id: 1 });

  const notifications = db.collection('notifications');
  await notifications.createIndex({ user_id: 1, created_at: -1 });
  await notifications.createIndex({ user_id: 1, is_read: 1, deleted: 1 });

  console.log('[mongodb] Index messages + notifications créés');
}

// Retourne la base MongoDB (erreur si pas encore connecté)
function getDb() {
  if (!db) throw new Error('MongoDB non connecté — appelez connectMongo() au démarrage');
  return db;
}

async function closeMongo() {
  if (client) { await client.close(); client = null; db = null; }
}

module.exports = { connectMongo, getDb, closeMongo };
