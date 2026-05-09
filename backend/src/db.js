const config = require('./config');

// ---------- MOCK MODE (local, no Azure) ----------
function createMockContainer(name) {
  const items = [];
  return {
    items: {
      create: async (doc) => {
        items.push({ ...doc, _ts: Date.now() });
        return { resource: doc };
      },
      query: (querySpec) => ({
        fetchAll: async () => {
          // Very simple mock: just return all items, filter in JS
          // (we ignore SQL and just give back everything sorted by _ts desc)
          let resources = [...items];

          // Handle parameterized queries used in our app
          const params = (querySpec.parameters || []).reduce((acc, p) => {
            acc[p.name] = p.value;
            return acc;
          }, {});

          // Filter by common patterns
          if (querySpec.query.includes('c.email = @e') && params['@e']) {
            resources = resources.filter(r => r.email === params['@e']);
          }
          if (querySpec.query.includes('c.id = @id') && params['@id']) {
            resources = resources.filter(r => r.id === params['@id']);
          }
          if (querySpec.query.includes('c.photoId = @p') && params['@p']) {
            resources = resources.filter(r => r.photoId === params['@p']);
          }
          if (querySpec.query.includes('LIKE @t') && params['@t']) {
            const term = params['@t'].replace(/%/g, '').toLowerCase();
            resources = resources.filter(r =>
              (r.title || '').toLowerCase().includes(term) ||
              (r.caption || '').toLowerCase().includes(term) ||
              (r.location || '').toLowerCase().includes(term) ||
              (r.autoTags || []).some(t => (t.name || '').toLowerCase().includes(term))
            );
          }

          // Sort by _ts desc (newest first)
          resources.sort((a, b) => (b._ts || 0) - (a._ts || 0));
          return { resources };
        }
      })
    },
    item: (id, partitionKey) => ({
      replace: async (doc) => {
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) items[idx] = { ...doc, _ts: Date.now() };
        return { resource: doc };
      },
      delete: async () => {
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
        return {};
      }
    }),
    _items: items // exposed for debugging
  };
}

let photos, users, comments;

if (config.useMocks) {
  console.log('🟡 Running in MOCK mode — using in-memory database');
  photos = createMockContainer('photos');
  users = createMockContainer('users');
  comments = createMockContainer('comments');
} else {
  console.log('🟢 Running with Azure Cosmos DB');
  const { CosmosClient } = require('@azure/cosmos');
  const client = new CosmosClient({
    endpoint: config.cosmos.endpoint,
    key: config.cosmos.key
  });
  const database = client.database(config.cosmos.database);
  photos = database.container('photos');
  users = database.container('users');
  comments = database.container('comments');
}

module.exports = { photos, users, comments };