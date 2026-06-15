const mongoose = require('mongoose');
require('dotenv').config();

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = mongoose.model('User', new mongoose.Schema({
            firstName: String,
            role: mongoose.Schema.Types.Mixed,
            roleName: String
        }));
        
        const users = await User.find().limit(5);
        users.forEach(u => {
            console.log(`USER: ${u.firstName} | role: ${JSON.stringify(u.role)} | roleName: ${u.roleName}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUser();
