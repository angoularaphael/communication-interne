const { ObjectId } = require('mongodb');
const { getDb } = require('../config/mongodb');
const productsClient = require('./productsClient');
const authClient = require('./authClient');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const ADMIN_AD_ID = 'admin';

function generateThreadCode(adId, userA, userB) {
  const sorted = [userA, userB].sort();
  return `${adId}_${sorted[0]}_${sorted[1]}`;
}

/** Un seul thread support par client : tous les admin/assistance partagent le même fil avec ce client */
function getSupportThreadCode(clientUserId) {
  return `${ADMIN_AD_ID}_${clientUserId}`;
}

function col() {
  return getDb().collection('messages');
}

function formatMessage(doc) {
  if (!doc) return null;
  const msg = { ...doc };
  msg.messageId = doc._id ? String(doc._id) : null;
  return msg;
}

async function sendMessage(senderId, adId, content) {
  if (!content || !content.trim()) {
    throw new BadRequestError('Le contenu du message est requis');
  }

  const productData = await productsClient.getProduct(adId);
  const product = productData.product || productData;
  const sellerId = product.seller_id || product.sellerId;

  if (!sellerId) {
    throw new NotFoundError('Annonce introuvable ou vendeur non identifié');
  }

  let receiverId;

  if (senderId === sellerId) {
    const existing = await col().findOne(
      { ad_id: adId, deleted: false, $or: [{ sender_id: senderId }, { receiver_id: senderId }] },
      { sort: { created_at: -1 } }
    );

    if (!existing) {
      throw new BadRequestError('Aucune conversation existante pour cette annonce. Le vendeur ne peut pas initier la conversation.');
    }

    receiverId = existing.sender_id === senderId ? existing.receiver_id : existing.sender_id;
  } else {
    receiverId = sellerId;
  }

  const threadCode = generateThreadCode(adId, senderId, receiverId);

  const message = {
    ad_id: adId,
    thread_code: threadCode,
    sender_id: senderId,
    receiver_id: receiverId,
    content: content.trim(),
    is_read: false,
    deleted: false,
    created_at: new Date()
  };

  const result = await col().insertOne(message);
  message._id = result.insertedId;
  return formatMessage(message);
}

async function getInbox(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const pipeline = [
    {
      $match: {
        deleted: false,
        $or: [{ sender_id: userId }, { receiver_id: userId }]
      }
    },
    { $sort: { created_at: -1 } },
    {
      $group: {
        _id: '$thread_code',
        ad_id: { $first: '$ad_id' },
        last_message: { $first: '$$ROOT' },
        total_messages: { $sum: 1 },
        unread_count: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$receiver_id', userId] }, { $eq: ['$is_read', false] }] },
              1,
              0
            ]
          }
        }
      }
    },
    { $sort: { 'last_message.created_at': -1 } },
    {
      $facet: {
        threads: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }]
      }
    }
  ];

  const [result] = await col().aggregate(pipeline).toArray();

  const threads = result.threads || [];
  const total = result.total[0]?.count || 0;

  const formatted = threads.map(t => {
    const otherId = t.last_message.sender_id === userId ? t.last_message.receiver_id : t.last_message.sender_id;
    return {
      thread_code: t._id,
      ad_id: t.ad_id,
      ad_title: null,
      other_participant_id: otherId,
      last_message: {
        _id: t.last_message._id,
        messageId: t.last_message._id?.toString?.(),
        sender_id: t.last_message.sender_id,
        receiver_id: t.last_message.receiver_id,
        content: t.last_message.content,
        is_read: t.last_message.is_read,
        created_at: t.last_message.created_at
      },
      total_messages: t.total_messages,
      unread_count: t.unread_count
    };
  });

  for (const t of formatted) {
    if (t.ad_id && t.ad_id !== ADMIN_AD_ID) {
      try {
        const data = await productsClient.getProduct(t.ad_id);
        const product = data.product || data;
        t.ad_title = product.title || product.name || null;
      } catch (_e) {
        t.ad_title = null;
      }
    }
    if (t.ad_id === ADMIN_AD_ID && t.other_participant_id) {
      try {
        const data = await authClient.getUser(t.other_participant_id);
        const u = data.user || data;
        t.other_participant_name =
          (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}`.trim() : null) ||
          u.username ||
          u.email ||
          'Support';
      } catch (_e) {
        t.other_participant_name = 'Support';
      }
    }
  }

  return {
    threads: formatted,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

async function getAdMessages(userId, adId) {
  const sample = await col().findOne({
    ad_id: adId,
    deleted: false,
    $or: [{ sender_id: userId }, { receiver_id: userId }]
  });

  if (!sample) {
    return { messages: [], thread_code: null };
  }

  const threadCode = sample.thread_code;

  const rawMessages = await col()
    .find({ thread_code: threadCode, deleted: false })
    .sort({ created_at: 1 })
    .toArray();

  await col().updateMany(
    { thread_code: threadCode, receiver_id: userId, is_read: false, deleted: false },
    { $set: { is_read: true } }
  );

  const messages = rawMessages.map(formatMessage);
  return { messages, thread_code: threadCode };
}

async function getThread(userId, threadCode) {
  const rawMessages = await col()
    .find({ thread_code: threadCode, deleted: false })
    .sort({ created_at: 1 })
    .toArray();

  if (rawMessages.length === 0) {
    throw new NotFoundError('Conversation introuvable');
  }

  const isParticipant = rawMessages.some(
    m => m.sender_id === userId || m.receiver_id === userId
  );
  if (!isParticipant) {
    throw new NotFoundError('Conversation introuvable');
  }

  await col().updateMany(
    { thread_code: threadCode, receiver_id: userId, is_read: false, deleted: false },
    { $set: { is_read: true } }
  );

  const messages = rawMessages.map(formatMessage);
  return { messages, thread_code: threadCode };
}

async function markAsRead(userId, messageId) {
  let oid;
  try {
    oid = new ObjectId(messageId);
  } catch (_e) {
    throw new BadRequestError('ID de message invalide');
  }

  const result = await col().updateOne(
    { _id: oid, receiver_id: userId, deleted: false },
    { $set: { is_read: true } }
  );

  if (result.matchedCount === 0) {
    throw new NotFoundError('Message introuvable');
  }

  return { updated: true };
}

async function getUnreadCount(userId) {
  const count = await col().countDocuments({
    receiver_id: userId,
    is_read: false,
    deleted: false
  });
  return { unread_count: count };
}

async function countMessagesForAd(adId) {
  const count = await col().countDocuments({ ad_id: adId, deleted: false });
  return { ad_id: adId, count };
}

async function softDeleteAdMessages(adId) {
  const result = await col().updateMany(
    { ad_id: adId, deleted: false },
    { $set: { deleted: true } }
  );
  return { ad_id: adId, deleted_count: result.modifiedCount };
}

async function adminStartConversation(adminId, targetUserId, content) {
  const threadCode = getSupportThreadCode(targetUserId);
  const existing = await col().findOne({ thread_code: threadCode, deleted: false });

  let message = null;
  if (content && content.trim()) {
    const receiverId = targetUserId;
    const msg = {
      ad_id: ADMIN_AD_ID,
      thread_code: threadCode,
      sender_id: adminId,
      receiver_id: receiverId,
      content: content.trim(),
      is_read: false,
      deleted: false,
      created_at: new Date()
    };
    const result = await col().insertOne(msg);
    msg._id = result.insertedId;
    message = formatMessage(msg);
  } else if (!existing) {
    const receiverId = targetUserId;
    const msg = {
      ad_id: ADMIN_AD_ID,
      thread_code: threadCode,
      sender_id: adminId,
      receiver_id: receiverId,
      content: 'Conversation démarrée par l\'assistance.',
      is_read: false,
      deleted: false,
      created_at: new Date()
    };
    const result = await col().insertOne(msg);
    msg._id = result.insertedId;
    message = formatMessage(msg);
  }

  return { thread_code: threadCode, ad_id: ADMIN_AD_ID, message };
}

async function adminSendMessage(adminId, targetUserId, content) {
  if (!content || !content.trim()) {
    throw new BadRequestError('Le contenu du message est requis');
  }
  const threadCode = getSupportThreadCode(targetUserId);
  const receiverId = targetUserId;

  const msg = {
    ad_id: ADMIN_AD_ID,
    thread_code: threadCode,
    sender_id: adminId,
    receiver_id: receiverId,
    content: content.trim(),
    is_read: false,
    deleted: false,
    created_at: new Date()
  };
  const result = await col().insertOne(msg);
  msg._id = result.insertedId;
  return formatMessage(msg);
}

async function sendMessageInThread(userId, threadCode, content) {
  if (!content || !content.trim()) {
    throw new BadRequestError('Le contenu du message est requis');
  }
  const existing = await col().findOne({ thread_code: threadCode, deleted: false });
  if (!existing) throw new NotFoundError('Conversation introuvable');

  const isParticipant = existing.sender_id === userId || existing.receiver_id === userId;
  if (!isParticipant) throw new NotFoundError('Conversation introuvable');

  let receiverId;
  if (existing.ad_id === ADMIN_AD_ID) {
    const clientId = threadCode.startsWith(ADMIN_AD_ID + '_') ? threadCode.slice(ADMIN_AD_ID.length + 1) : null;
    if (userId === clientId) {
      const lastStaff = await col().findOne(
        { thread_code: threadCode, sender_id: { $ne: userId }, deleted: false },
        { sort: { created_at: -1 }, projection: { sender_id: 1 } }
      );
      receiverId = lastStaff ? lastStaff.sender_id : null;
      if (!receiverId) throw new BadRequestError('Impossible de déterminer le destinataire.');
    } else {
      receiverId = clientId;
    }
  } else {
    receiverId = existing.sender_id === userId ? existing.receiver_id : existing.sender_id;
  }

  const msg = {
    ad_id: existing.ad_id,
    thread_code: threadCode,
    sender_id: userId,
    receiver_id: receiverId,
    content: content.trim(),
    is_read: false,
    deleted: false,
    created_at: new Date()
  };
  const result = await col().insertOne(msg);
  msg._id = result.insertedId;
  return formatMessage(msg);
}

async function adminBroadcast(senderId, userIds, content) {
  if (!content || !content.trim()) throw new BadRequestError('Le contenu du message est requis');
  if (!Array.isArray(userIds) || userIds.length === 0) throw new BadRequestError('Aucun destinataire sélectionné');
  const trimmed = [...new Set(userIds)].filter(Boolean);
  const results = [];
  for (const targetUserId of trimmed) {
    try {
      const threadCode = getSupportThreadCode(targetUserId);
      const existing = await col().findOne({ thread_code: threadCode, deleted: false });
      if (!existing) {
        await col().insertOne({
          ad_id: ADMIN_AD_ID,
          thread_code: threadCode,
          sender_id: senderId,
          receiver_id: targetUserId,
          content: 'Conversation démarrée par l\'assistance.',
          is_read: false,
          deleted: false,
          created_at: new Date()
        });
      }
      const msg = {
        ad_id: ADMIN_AD_ID,
        thread_code: threadCode,
        sender_id: senderId,
        receiver_id: targetUserId,
        content: content.trim(),
        is_read: false,
        deleted: false,
        created_at: new Date()
      };
      const result = await col().insertOne(msg);
      msg._id = result.insertedId;
      results.push({ userId: targetUserId, message: formatMessage(msg) });
    } catch (e) {
      results.push({ userId: targetUserId, error: e.message });
    }
  }
  return { sent: results.filter(r => r.message).length, total: trimmed.length, results };
}

module.exports = {
  sendMessage,
  getInbox,
  getAdMessages,
  getThread,
  markAsRead,
  getUnreadCount,
  countMessagesForAd,
  softDeleteAdMessages,
  adminStartConversation,
  adminSendMessage,
  sendMessageInThread,
  adminBroadcast
};
