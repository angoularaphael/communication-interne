/**
 * Fausse collection MongoDB en mémoire — utilisée pour tester les services
 * notifications/messages sans démarrer de vrai serveur Mongo.
 *
 * Implémente la sous-API utilisée par notification.service / message.service :
 *   findOne, find().sort().skip().limit().toArray(), countDocuments,
 *   insertOne, updateOne ($set), updateMany ($set).
 *
 * Les ObjectId sont représentés par un objet { toString } compatible avec
 * `new ObjectId(value)` côté driver (le test passe directement le string).
 */

function matches(doc, filter) {
  for (const [key, val] of Object.entries(filter)) {
    if (val && typeof val === 'object' && '$in' in val) {
      if (!val.$in.includes(doc[key])) return false;
    } else if (val && typeof val === 'object' && val.constructor && val.constructor.name === 'ObjectId') {
      // Comparer via toString pour rester agnostique du driver.
      if (doc[key]?.toString?.() !== val.toString()) return false;
    } else if (doc[key] !== val) {
      return false;
    }
  }
  return true;
}

function createFakeCollection() {
  const docs = [];
  let nextId = 1;

  function makeId() {
    const id = String(nextId++).padStart(24, '0');
    return { toString: () => id, _isFakeId: true };
  }

  return {
    insertOne(doc) {
      const _id = makeId();
      const inserted = { _id, ...doc };
      docs.push(inserted);
      return Promise.resolve({ insertedId: _id });
    },

    findOne(filter) {
      return Promise.resolve(docs.find((d) => matches(d, filter)) || null);
    },

    find(filter) {
      const filtered = docs.filter((d) => matches(d, filter));
      let sorted = filtered;
      let _skip = 0;
      let _limit = Infinity;

      const cursor = {
        sort(spec) {
          const [field, dir] = Object.entries(spec)[0];
          sorted = [...filtered].sort((a, b) => {
            const av = a[field];
            const bv = b[field];
            if (av === bv) return 0;
            return (av > bv ? 1 : -1) * (dir === 1 ? 1 : -1);
          });
          return cursor;
        },
        skip(n) { _skip = n; return cursor; },
        limit(n) { _limit = n; return cursor; },
        toArray() { return Promise.resolve(sorted.slice(_skip, _skip + _limit)); }
      };

      return cursor;
    },

    countDocuments(filter) {
      return Promise.resolve(docs.filter((d) => matches(d, filter)).length);
    },

    updateOne(filter, update) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
      if (update.$set) Object.assign(doc, update.$set);
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    },

    updateMany(filter, update) {
      const matched = docs.filter((d) => matches(d, filter));
      for (const doc of matched) {
        if (update.$set) Object.assign(doc, update.$set);
      }
      return Promise.resolve({ matchedCount: matched.length, modifiedCount: matched.length });
    },

    _all: () => docs,
    _reset: () => { docs.length = 0; nextId = 1; }
  };
}

module.exports = { createFakeCollection };
