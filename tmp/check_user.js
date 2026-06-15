
const mongoose = require('mongoose');
const path = require('path');

async function check() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hrms_db_main');
        console.log('Connected to main DB');
        
        const UserSchema = require('./server/models/User');
        const User = mongoose.model('User', UserSchema);
        
        const userId = '69c5735ad01f8b09a617616b';
        const user = await User.findById(userId);
        
        if (user) {
            console.log('Found user:', user.email, 'Role:', user.role);
            console.log('Permissions count:', user.permissions.length);
            
            const ticketPerm = user.permissions.find(p => p.module === 'support.tickets');
            if (ticketPerm) {
                console.log('support.tickets perm found:', JSON.stringify(ticketPerm));
            } else {
                console.log('support.tickets perm NOT found in user.permissions');
            }
            
            const overviewDashboard = user.permissions.find(p => p.module === 'overview.dashboard');
             console.log('overview.dashboard perm:', JSON.stringify(overviewDashboard));

        } else {
            console.log('User not found:', userId);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

check();
