
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
            
            // Check RBAC engine result
            const rbac = require('./server/utils/rbac');
            const bundle = await rbac.resolveUserPermissionBundle({ 
                userId: user._id, 
                tenantId: user.tenant 
            });
            
            const ticketPerm = bundle.permissions.find(p => p.module === 'support.tickets');
            console.log('RBAC Resolve result for support.tickets:', JSON.stringify(ticketPerm));
            
            console.log('Total modules in bundle:', bundle.permissions.length);

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
