/**
 * MIGRATION SCRIPT: Set friendly database names for existing tenants.
 * This script updates the 'companies' collection in the global database.
 * NOTE: You must manually rename the databases in MongoDB Atlas AFTER running this script,
 * otherwise the app will not be able to find the data.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const Tenant = require('../server/models/Tenant');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const tenants = await Tenant.find({ $or: [{ databaseName: null }, { databaseName: '' }] });
    console.log(`Found ${tenants.length} tenants requiring database name update.`);
    
    for (const t of tenants) {
      const companyName = t.companyName || t.name || 'company';
      const code = t.code || t.tenantId || t._id.toString().substring(18);
      
      const safeDbName = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 25);
      
      const newDbName = `company_${safeDbName}_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      console.log(`Updating Tenant [${t._id}]: ${companyName} -> ${newDbName}`);
      
      t.databaseName = newDbName;
      await t.save();
      
      const oldDbName = `company_${t._id}`;
      console.log(`  IMPORTANT: You must rename database "${oldDbName}" to "${newDbName}" in MongoDB Atlas.`);
    }
    
    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
