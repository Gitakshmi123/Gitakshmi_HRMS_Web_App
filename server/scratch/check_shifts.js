const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const getTenantDB = require('../utils/tenantDB');

async function checkShifts() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);

  // We find all collections starting with tenant_ or find company IDs from Company model
  const dbAdmin = mongoose.connection.db.admin();
  const dbs = await dbAdmin.listDatabases();
  console.log('Available Databases:');
  
  for (const database of dbs.databases) {
    if (database.name.startsWith('company_') || database.name.includes('tenant') || database.name.includes('gitakshmi')) {
      console.log(`- Database: ${database.name}`);
      try {
        const tenantDb = mongoose.connection.useDb(database.name);
        const collections = await tenantDb.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (collectionNames.includes('shiftmasters')) {
          const ShiftMaster = tenantDb.model('ShiftMaster', new mongoose.Schema({}, { strict: false }), 'shiftmasters');
          const count = await ShiftMaster.countDocuments({});
          console.log(`  -> shiftmasters count: ${count}`);
          if (count > 0) {
            const list = await ShiftMaster.find({}).lean();
            list.forEach(s => {
              console.log(`     * Code: ${s.code}, Name: ${s.name}, Status: ${s.status}, TenantField: ${s.tenant}`);
            });
          }
        }
      } catch (err) {
        console.error(`Error reading database ${database.name}:`, err.message);
      }
    }
  }

  // Also query the main DB companies/tenants
  try {
    const mainDb = mongoose.connection;
    const collections = await mainDb.db.listCollections().toArray();
    console.log('Main DB collections:', collections.map(c => c.name));
    
    // Find Companies
    if (collections.map(c => c.name).includes('companies')) {
      const Company = mainDb.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
      const companies = await Company.find({}).lean();
      console.log('Companies in Main DB:');
      companies.forEach(c => {
        console.log(`  * ID: ${c._id}, Name: ${c.name || c.companyName}, DbName: ${c.dbName}`);
      });
    }
  } catch (err) {
    console.error('Error reading main DB collections:', err.message);
  }

  await mongoose.disconnect();
}

checkShifts();
