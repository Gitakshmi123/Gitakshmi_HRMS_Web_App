#!/usr/bin/env node
/**
 * BGV Unique Index Migration
 * 
 * Purpose: Add unique compound indexes to BGVCase collection to prevent duplicate cases
 * 
 * Usage:
 *   node server/migrations/add-bgv-unique-indexes.js
 * 
 * Note: This script should run AFTER deploying the schema changes
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(`${color}`, ...args, colors.reset);
}

async function main() {
  try {
    log(colors.blue, '═══════════════════════════════════════════════════════');
    log(colors.blue, '  BGV Unique Index Migration');
    log(colors.blue, '═══════════════════════════════════════════════════════\n');

    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/hrms';
    log(colors.cyan, `[MIGRATION] Connecting to MongoDB: ${mongoUrl}`);
    
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    log(colors.green, '✓ Connected to MongoDB\n');

    // Get the main MongoDB connection
    const mainDb = mongoose.connection;
    
    // Get all databases/tenants
    const admin = mainDb.db.admin();
    const databaseList = await admin.listDatabases();
    
    log(colors.cyan, `[MIGRATION] Found ${databaseList.databases.length} databases`);
    log(colors.cyan, `[MIGRATION] Processing tenant databases only....\n`);

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // Process each tenant database
    for (const dbInfo of databaseList.databases) {
      const dbName = dbInfo.name;
      
      // Skip system databases
      if (dbName.startsWith('admin') || dbName.startsWith('config') || dbName === 'local' || dbName === 'test') {
        log(colors.yellow, `⊘ Skipping system database: ${dbName}`);
        skipCount++;
        continue;
      }

      log(colors.yellow, `\n► Processing database: ${dbName}`);

      try {
        // Get database connection
        const tenantDb = mainDb.db.getMongo().getDB(dbName);
        
        // Check if bgv_cases collection exists
        const collections = await tenantDb.listCollections().toArray();
        const hasBGVCollection = collections.some(c => c.name === 'bgv_cases');
        
        if (!hasBGVCollection) {
          log(colors.yellow, `  ⊘ No bgv_cases collection found. Skipping.`);
          skipCount++;
          continue;
        }

        const bgvCollection = tenantDb.collection('bgv_cases');
        
        // Create indexes
        log(colors.cyan, `  [INDEX] Creating indexes for ${dbName}`);

        // 1. Basic composite indexes for queries
        await bgvCollection.createIndex({ tenant: 1, overallStatus: 1 });
        log(colors.green, `    ✓ Index created: { tenant: 1, overallStatus: 1 }`);

        await bgvCollection.createIndex({ tenant: 1, isClosed: 1 });
        log(colors.green, `    ✓ Index created: { tenant: 1, isClosed: 1 }`);

        await bgvCollection.createIndex({ tenant: 1, createdAt: -1 });
        log(colors.green, `    ✓ Index created: { tenant: 1, createdAt: -1 }`);

        // 2. Unique compound indexes to prevent duplicates (per-tenant, per-candidate, non-closed only)
        await bgvCollection.createIndex(
          { tenant: 1, candidateId: 1, isClosed: 1 },
          { 
            unique: true,
            sparse: true,
            partialFilterExpression: { isClosed: false }
          }
        );
        log(colors.green, `    ✓ Unique index created: { tenant: 1, candidateId: 1, isClosed: 1 }`);

        // 3. Unique compound index for employeeId
        await bgvCollection.createIndex(
          { tenant: 1, employeeId: 1, isClosed: 1 },
          { 
            unique: true,
            sparse: true,
            partialFilterExpression: { isClosed: false }
          }
        );
        log(colors.green, `    ✓ Unique index created: { tenant: 1, employeeId: 1, isClosed: 1 }`);

        log(colors.green, `  ✓ Indexes created successfully for ${dbName}`);
        successCount++;

      } catch (err) {
        // Ignore "Index already exists" errors
        if (err.code === 85 || err.message.includes('already exists')) {
          log(colors.yellow, `  ⚠ Index already exists (${err.code}). Skipping.`);
          successCount++;
        } else {
          log(colors.red, `  ✗ Error creating indexes for ${dbName}:`, err.message);
          errorCount++;
        }
      }
    }

    // Summary
    log(colors.blue, `\n═══════════════════════════════════════════════════════`);
    log(colors.blue, `  Migration Summary`);
    log(colors.blue, `═══════════════════════════════════════════════════════`);
    log(colors.green, `  ✓ Processed: ${successCount}`);
    log(colors.yellow, `  ⊘ Skipped: ${skipCount}`);
    if (errorCount > 0) {
      log(colors.red, `  ✗ Errors: ${errorCount}`);
    }
    log(colors.blue, `═══════════════════════════════════════════════════════\n`);

    if (errorCount === 0) {
      log(colors.green, '✓ Migration completed successfully!');
      log(colors.cyan, '\nNext steps:');
      log(colors.cyan, '1. Deploy backend changes (bgv.controller.js with 409 status)');
      log(colors.cyan, '2. Restart backend server');
      log(colors.cyan, '3. Deploy frontend changes (error handling for 409)');
      log(colors.cyan, '4. Test BGV initiation with duplicate candidate');
    } else {
      log(colors.red, `\n✗ Migration completed with ${errorCount} error(s). Please review logs above.`);
      process.exit(1);
    }

  } catch (err) {
    log(colors.red, '✗ Fatal error during migration:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log(colors.blue, '\n[MIGRATION] Disconnected from MongoDB');
  }
}

// Run migration
main().catch(err => {
  log(colors.red, 'Unhandled error:', err);
  process.exit(1);
});
