const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const UserSchema = require('./models/User');
const Tenant = require('./models/Tenant');

async function grantHiringPermissions() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const tenant = await Tenant.findOne({ code: 'GIT001' });
        if (!tenant) {
            console.log('Tenant GIT001 not found');
            return;
        }

        let User;
        try {
            User = mongoose.model('User');
        } catch (e) {
            User = mongoose.model('User', UserSchema);
        }

        const users = await User.find({ tenant: tenant._id });
        console.log(`Updating ${users.length} users...`);

        for (const user of users) {
            let modified = false;
            user.permissions.forEach(p => {
                if (p.module.startsWith('hiring.') || p.module.startsWith('recruitment.')) {
                    p.actions.view = true;
                    modified = true;
                }
            });
            
            if (modified) {
                user.markModified('permissions');
                await user.save();
                console.log(`Updated permissions for ${user.email}`);
            } else {
                console.log(`No hiring modules found for ${user.email}, adding basic ones...`);
                user.permissions.push({
                    module: 'hiring.tracker',
                    section: 'General',
                    actions: { view: true, create: false, edit: false, delete: false }
                });
                user.markModified('permissions');
                await user.save();
                console.log(`Added hiring.tracker to ${user.email}`);
            }
        }
        
        await mongoose.disconnect();
        console.log('Done');
    } catch (err) {
        console.error(err);
    }
}

grantHiringPermissions();
