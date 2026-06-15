const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function listData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to Main DB:", mongoose.connection.name);

        const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }));
        const companies = await Company.find({}).lean();
        
        console.log("\n--- COMPANIES COUNT:", companies.length);
        companies.forEach(c => {
            console.log(`Code: ${c.companyCode || c.code} | Name: ${c.name || c.companyName} | Status: ${c.status}`);
        });

        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const users = await User.find({}).limit(5).lean();
        console.log("\n--- USERS COUNT:", users.length);
        users.forEach(u => {
            console.log(`Name: ${u.name} | Email: ${u.email} | Role: ${u.role}`);
        });

    } catch (err) {
        console.error("❌ FAILED:", err.message);
    }
    process.exit(0);
}

listData();
