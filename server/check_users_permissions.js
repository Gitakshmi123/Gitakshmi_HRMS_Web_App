const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const UserSchema = require('./models/User');
const Tenant = require('./models/Tenant');

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const tenant = await Tenant.findOne({ code: 'GIT001' });
        
        if (!tenant) {
            console.log('Tenant GIT001 not found');
            return;
        }
        
        console.log('Tenant ID:', tenant._id);
        
        let User;
        try {
            User = mongoose.model('User');
        } catch (e) {
            User = mongoose.model('User', UserSchema);
        }

        const users = await User.find({ tenant: tenant._id });
        console.log(`Found ${users.length} users for tenant ${tenant.code}`);
        
        users.forEach(u => {
            console.log(`- ${u.email} (Role: ${u.role})`);
            console.log(`  Permissions: ${JSON.stringify(u.permissions, null, 2)}`);
        });
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkUsers();
