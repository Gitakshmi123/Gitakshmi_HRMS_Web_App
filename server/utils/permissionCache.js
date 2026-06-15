/**
 * permissionCache.js — In-Memory Permission Cache
 * ──────────────────────────────────────────────────────────────────
 * No Redis needed. Simple Map with TTL expiry per entry.
 * Keys: `${tenantId}:${userId}` → cached permission result
 * TTL:  30 seconds (configurable via RBAC_CACHE_TTL_MS env)
 *
 * Usage:
 *   const cache = require('./permissionCache');
 *   cache.set(tenantId, userId, { permissions, role, permVersion });
 *   cache.get(tenantId, userId) → value or null
 *   cache.invalidate(tenantId, userId) → clears specific user
 *   cache.invalidateTenant(tenantId) → clears all users in tenant
 */

const TTL_MS = parseInt(process.env.RBAC_CACHE_TTL_MS || '30000', 10); // 30s default

class PermissionCache {
  constructor() {
    this._store = new Map();  // key → { value, expiresAt }
    this._stats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };

    // Auto-cleanup expired entries every 60 seconds
    setInterval(() => this._cleanup(), 60_000);
  }

  _key(tenantId, userId) {
    return `${tenantId}:${userId}`;
  }

  /** Store a value with TTL */
  set(tenantId, userId, value) {
    const key = this._key(tenantId, userId);
    this._store.set(key, {
      value,
      expiresAt: Date.now() + TTL_MS,
      tenantId: String(tenantId),
    });
    this._stats.sets++;
  }

  /** Retrieve value or null if missing/expired */
  get(tenantId, userId) {
    const key = this._key(tenantId, userId);
    const entry = this._store.get(key);
    if (!entry) { this._stats.misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._stats.misses++;
      return null;
    }
    this._stats.hits++;
    return entry.value;
  }

  /** Invalidate a specific user's cache */
  invalidate(tenantId, userId) {
    const key = this._key(tenantId, userId);
    const deleted = this._store.delete(key);
    if (deleted) this._stats.invalidations++;
    return deleted;
  }

  /** Invalidate ALL users in a tenant */
  invalidateTenant(tenantId) {
    const prefix = String(tenantId) + ':';
    let count = 0;
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) { this._store.delete(key); count++; }
    }
    this._stats.invalidations += count;
    return count;
  }

  /** Remove all expired entries */
  _cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this._store.entries()) {
      if (now > entry.expiresAt) { this._store.delete(key); removed++; }
    }
    if (removed > 0) console.log(`[PermCache] Cleaned ${removed} expired entries. Store size: ${this._store.size}`);
  }

  /** Debug stats */
  stats() {
    return {
      ...this._stats,
      size: this._store.size,
      hitRate: this._stats.hits + this._stats.misses > 0
        ? ((this._stats.hits / (this._stats.hits + this._stats.misses)) * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }
}

// Export singleton — shared across all requests in this Node.js process
module.exports = new PermissionCache();
