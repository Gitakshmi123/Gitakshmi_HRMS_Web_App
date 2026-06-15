
const mongoose = require('mongoose');
require('./app'); // Registers all models
const rbac = require('./utils/rbac');

async function check() {
    try {
        console.log('Connected to DB');
        
        const userId = '69c5735ad01f8b09a617616b';
        const bundle = await rbac.resolveUserPermissionBundle({ 
            userId: userId, 
            tenantId: '69c56fa3d01f8b09a61759d4' 
        });
        
        console.log('Role:', bundle.role);
        const ticketPerm = bundle.permissions.find(p => p.module === 'support.tickets');
        console.log('support.tickets perm:', JSON.stringify(ticketPerm));
        console.log('Total modules:', bundle.permissions.length);
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

check();
