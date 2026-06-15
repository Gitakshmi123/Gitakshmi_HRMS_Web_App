const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function run() {
    try {
        console.log('Connecting to', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const User = mongoose.connection.collection('users');
        const user = await User.findOne({ name: /Dhruv/i });
        console.log('User details for Dhruv:', JSON.stringify(user, null, 2));

        const allUsers = await User.find({}).project({ name: 1, email: 1, role: 1, mainCompanyId: 1, tenant: 1 }).toArray();
        console.log('All Users:', allUsers);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
