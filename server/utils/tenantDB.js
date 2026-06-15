const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { getTenantDB: getDbFromManager } = require('../config/dbManager');

/**
 * getTenantDB
 * Accepts either a tenant code (string) or a tenant _id (ObjectId/string).
 * Returns a mongoose Connection object for the tenant database using mongoose.connection.useDb
 * Uses the optimized dbManager for connection pooling and caching.
 */
module.exports = async function getTenantDB(tenantIdentifier) {
  if (!tenantIdentifier) {
    console.warn('getTenantDB: Missing tenantIdentifier, returning null');
    return null;
  }

  let tenantId = tenantIdentifier;
  let code = tenantIdentifier;

  let dbName = null;
  // If a code string was passed, try to resolve to tenant ID first
  // Otherwise use ID directly
  try {
    if (!mongoose.Types.ObjectId.isValid(String(tenantIdentifier))) {
      // Public portal identifiers can be stored in either `code` or `tenantId`.
      const identifier = String(tenantIdentifier).trim();
      const rx = new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const t = await Tenant.findOne({
        $or: [
          { code: rx },
          { tenantId: rx },
          { companyCode: rx }
        ]
      }).lean();
      if (!t) {
        console.warn(`Tenant not found for code: ${tenantIdentifier}, using code as fallback`);
      } else {
        tenantId = t._id.toString();
        code = t.code || t.tenantId || identifier;
        dbName = t.databaseName;
      }
    } else {
      // It's a valid ObjectId, resolve to get the code
      const t = await Tenant.findById(tenantIdentifier).lean();
      if (t) {
        code = t.code;
        dbName = t.databaseName;
      } else {
        console.warn(`Tenant not found for ID: ${tenantIdentifier}, using ID directly`);
      }
    }
  } catch (e) {
    console.error('Error resolving tenant:', e.message);
    // Continue with what we have
  }

  // Use the optimized dbManager for connection pooling
  const db = await getDbFromManager(tenantId || code, dbName);
  db.tenantId = tenantId; // Attach the resolved ObjectId for internal queries
  return db;
};
