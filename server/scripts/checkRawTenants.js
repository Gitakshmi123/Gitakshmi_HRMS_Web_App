const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function check() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const ts = await mongoose.connection.db.collection('tenants').find({}).toArray();
    console.log('Tenants in raw collection:', ts.length);
    if (ts.length > 0) {
        console.log(JSON.stringify(ts.map(t => ({ id: t._id, code: t.code, status: t.status })), null, 2));
    }
    process.exit(0);
}
check();
