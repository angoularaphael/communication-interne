const { MongoClient } = require('mongodb');
const env = require('./env');

let client = null;
let db = null;

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

async function ensureIndexes() {
  const col = db.collection('messages');

  await col.createIndex({ thread_code: 1, created_at: 1 });
  await col.createIndex({ ad_id: 1, deleted: 1 });
  await col.createIndex({ sender_id: 1, deleted: 1 });
  await col.createIndex({ receiver_id: 1, is_read: 1, deleted: 1 });
  await col.createIndex({ ad_id: 1, sender_id: 1, receiver_id: 1 });

  console.log('[mongodb] Index messages créés');
}

function getDb() {
  if (!db) throw new Error('MongoDB non connecté — appelez connectMongo() au démarrage');
  return db;
}

async function closeMongo() {
  if (client) { await client.close(); client = null; db = null; }
}

module.exports = { connectMongo, getDb, closeMongo };
