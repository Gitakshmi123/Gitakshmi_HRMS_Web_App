const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // We need to iterate over all tenant databases to find BGVDocument records
        const adminDb = mongoose.connection.useDb('gitakshmi-one'); // Main DB
        const Tenant = adminDb.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
        
        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants`);

        for (const tenant of tenants) {
            const tenantId = tenant._id.toString();
            console.log(`Checking tenant: ${tenantId} (${tenant.companyName || 'N/A'})`);
            
            const tenantDb = mongoose.connection.useDb(tenantId);
            const BGVDocument = tenantDb.model('BGVDocument', new mongoose.Schema({
                filePath: String,
                originalName: String,
                documentType: String,
                caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'BGVCase' }
            }), 'bgv_documents');

            const docs = await BGVDocument.find({ isDeleted: { $ne: true } }).limit(5).lean();
            if (docs.length > 0) {
                console.log(`  Found ${docs.length} documents:`);
                docs.forEach(d => {
                    console.log(`    - [${d.documentType}] ${d.originalName} -> ${d.filePath}`);
                });
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
