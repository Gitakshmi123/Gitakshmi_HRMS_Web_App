const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
const mongoose = require('mongoose');
require('dotenv').config();
const Tenant = require('./models/Tenant');

const LeavePolicySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    name: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
    isActive: { type: Boolean, default: true },
    applicableTo: { type: String, default: 'All' },
    rules: { type: Array, default: [] }
}, { strict: false });

async function run() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('No MONGO_URI');
        
        await mongoose.connect(uri);
        console.log('Connected to Main DB');
        
        const tenants = await Tenant.find();
        console.log(`Found ${tenants.length} tenants.`);
        
        for (const tenant of tenants) {
            const dbName = tenant.dbName || `tenant_${tenant.code}`;
            console.log(`Checking DB: ${dbName} for tenant: ${tenant.code}`);
            
            const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
            const LeavePolicy = tenantDb.model('LeavePolicy', LeavePolicySchema);
            
            const policies = await LeavePolicy.find().sort({ createdAt: 1 });
            console.log(`  Found ${policies.length} policies.`);
            
            const seen = new Set();
            const toDelete = [];
            
            for (const policy of policies) {
                // If we see duplicate standard policies, keep only the first one
                if (policy.name === 'STANDARD POLICY') {
                    if (seen.has(policy.name)) {
                        toDelete.push(policy._id);
                    } else {
                        seen.add(policy.name);
                    }
                }
            }
            
            if (toDelete.length > 0) {
                console.log(`  Deleting duplicates:`, toDelete);
                await LeavePolicy.deleteMany({ _id: { $in: toDelete } });
                console.log(`  Deleted ${toDelete.length} duplicate policies.`);
            } else {
                console.log(`  No duplicate STANDARD POLICY found.`);
            }
        }
        
        console.log('Done.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
