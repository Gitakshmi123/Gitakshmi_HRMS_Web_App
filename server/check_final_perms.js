
const mongoose = require('mongoose');
const UserSchema = require('./models/User'); // this is a schema object
if (!mongoose.models.User) mongoose.model('User', UserSchema);
const rbac = require('./utils/rbac');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to DB');
        
        const userId = '69c5735ad01f8b09a617616b';
        const bundle = await rbac.resolveUserPermissionBundle({ 
            userId: userId, 
            tenantId: '69c56fa3d01f8b09a61759d4' 
        });
        
        console.log('Role:', bundle.role);
        const supportPerm = bundle.permissions.find(p => p.module === 'support.tickets');
        console.log('Final support.tickets permissions:', JSON.stringify(supportPerm));
        
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await mongoose.disconnect();
    }
}

check();
