const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function check() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const ts = await mongoose.connection.db.collection('companies').findOne({ code: 'dem001' });
    console.log(JSON.stringify(ts, null, 2));
    process.exit(0);
}
check();
