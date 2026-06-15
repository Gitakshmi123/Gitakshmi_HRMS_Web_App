const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const MONGO_URI = 'mongodb://localhost:27017/hrms';

async function checkUsers() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to local MongoDB');
        
        const User = mongoose.model('User', new mongoose.Schema({ email: String, username: String }));
        const users = await User.find({});
        
        console.log(`Found ${users.length} users in local DB:`);
        users.forEach(u => console.log(`- ${u.email || u.username}`));
        
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkUsers();
