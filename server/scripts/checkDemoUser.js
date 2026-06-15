const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function check() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'demo@gmail.com' });
    console.log(JSON.stringify(user, null, 2));
    process.exit(0);
}
check();
