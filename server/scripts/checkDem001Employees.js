const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function check() {
    const uri = process.env.MONGO_URI;
    const conn = await mongoose.createConnection(uri).asPromise();
    const ts = await conn.db.collection('companies').findOne({ code: 'dem001' });
    if (!ts) { console.log('Company dem001 not found'); process.exit(1); }
    
    const dbName = ts.databaseName;
    console.log('Switching to DB:', dbName);
    const tenantConn = conn.useDb(dbName, { useCache: true });
    
    const emps = await tenantConn.collection('employees').find({}).toArray();
    console.log('Employees in', dbName, ':', emps.length);
    if (emps.length > 0) {
        console.log(JSON.stringify(emps.map(e => ({ id: e._id, email: e.email, personalEmail: e.personalEmail, firstName: e.firstName })), null, 2));
    }
    process.exit(0);
}
check().catch(err => { console.error(err); process.exit(1); });
