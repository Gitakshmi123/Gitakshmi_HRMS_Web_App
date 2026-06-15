const mongoose = require('mongoose');

const DEFAULT_MAX_CONNECTIONS = Number(process.env.TENANT_DB_CACHE_SIZE || 75);
const MAX_DB_NAME_BYTES = 63;
const tenantConnectionCache = new Map();

function sanitizeDatabaseName(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const fallback = `tenant_${Date.now()}`;
  let dbName = normalized || fallback;
  while (Buffer.byteLength(dbName, 'utf8') > MAX_DB_NAME_BYTES) {
    dbName = dbName.slice(0, -1);
  }
  return dbName;
}

function buildTenantDatabaseName({ companyName, slug, tenantId }) {
  const namePart = sanitizeDatabaseName(slug || companyName || 'company').slice(0, 24);
  const idPart = String(tenantId || '').replace(/[^a-f0-9]/gi, '').slice(-10);
  return sanitizeDatabaseName(`hrms_${namePart}_${idPart}`);
}

function touchCacheEntry(cacheKey, connection) {
  tenantConnectionCache.set(cacheKey, {
    connection,
    lastUsedAt: Date.now()
  });
}

function evictLeastRecentlyUsed(maxConnections = DEFAULT_MAX_CONNECTIONS) {
  if (tenantConnectionCache.size < maxConnections) return;

  let oldestKey = null;
  let oldestTime = Infinity;
  for (const [key, entry] of tenantConnectionCache.entries()) {
    if (entry.lastUsedAt < oldestTime) {
      oldestTime = entry.lastUsedAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    tenantConnectionCache.delete(oldestKey);
  }
}

function assertMainConnectionReady() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Main MongoDB connection is not ready');
  }
}

function getMainConnection() {
  assertMainConnectionReady();
  return mongoose.connection;
}

function getTenantConnection({ tenantId, databaseName }) {
  assertMainConnectionReady();
  if (!tenantId) throw new Error('tenantId is required');
  if (!databaseName) throw new Error('databaseName is required');

  const safeDatabaseName = sanitizeDatabaseName(databaseName);
  const cacheKey = `${tenantId}:${safeDatabaseName}`;
  const cached = tenantConnectionCache.get(cacheKey);

  if (cached) {
    cached.lastUsedAt = Date.now();
    return cached.connection;
  }

  evictLeastRecentlyUsed();
  const connection = mongoose.connection.useDb(safeDatabaseName, { useCache: true });
  connection.tenantId = String(tenantId);
  connection.databaseName = safeDatabaseName;
  touchCacheEntry(cacheKey, connection);
  return connection;
}

function getCacheStats() {
  return {
    cachedTenants: tenantConnectionCache.size,
    maxCachedTenants: DEFAULT_MAX_CONNECTIONS,
    tenants: Array.from(tenantConnectionCache.entries()).map(([key, entry]) => ({
      key,
      databaseName: entry.connection.name,
      lastUsedAt: new Date(entry.lastUsedAt).toISOString()
    }))
  };
}

module.exports = {
  buildTenantDatabaseName,
  getCacheStats,
  getMainConnection,
  getTenantConnection,
  sanitizeDatabaseName
};
