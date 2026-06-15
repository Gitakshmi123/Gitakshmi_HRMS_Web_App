#!/usr/bin/env node
/**
 * Migration: Drop old unique index on offers (tenant + applicationId)
 * Required for Offer Versioning - multiple offers per application
 * Run once: node server/scripts/migrate_offer_versioning.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    const offerColl = collections.find(c => c.name === 'offers');
    if (!offerColl) {
      console.log('No offers collection found. Skip.');
      process.exit(0);
      return;
    }

    const coll = db.collection('offers');
    const indexes = await coll.indexes();

    const oldUnique = indexes.find(i => i.unique && i.key.tenant === 1 && i.key.applicationId === 1);
    if (oldUnique) {
      await coll.dropIndex(oldUnique.name);
      console.log('✅ Dropped old unique index:', oldUnique.name);
    } else {
      console.log('ℹ No old unique index found. Already migrated or fresh DB.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
