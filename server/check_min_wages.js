const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function check() {
  try {
     const uri = process.env.MONGO_URI;
     if (!uri) throw new Error('No MONGO_URI');
     
     await mongoose.connect(uri);
     console.log('Connected to DB');
     
     const MinimumWageSchema = require('./models/MinimumWage');
     
     const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
     const tenants = await Tenant.find({});
     console.log(`Found ${tenants.length} tenants:`);
     
     for (const t of tenants) {
       console.log(`Tenant: ${t.name} (Code: ${t.code}, DB Name: ${t.dbName})`);
       
       const dbUri = uri.replace(/\/[^/]*\?/, `/${t.dbName || 'gitakshmi_hrms'}?`);
       const tenantConn = await mongoose.createConnection(dbUri).asPromise();
       console.log(`Connected to tenant DB: ${t.dbName || 'gitakshmi_hrms'}`);
       
       const MinimumWage = tenantConn.model('MinimumWage', MinimumWageSchema);
       const wages = await MinimumWage.find({});
       console.log(`  Found ${wages.length} minimum wages in tenant database.`);
       wages.forEach(w => {
         console.log(`    State: ${w.state}, Category: ${w.category}, Monthly: ${w.monthlyAmount}`);
       });
       await tenantConn.close();
     }
     
     process.exit(0);
  } catch (e) {
     console.error(e);
     process.exit(1);
  }
}

check();
