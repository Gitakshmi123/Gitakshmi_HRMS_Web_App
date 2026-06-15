const mongoose = require('mongoose');
require('dotenv').config();

async function fixTenants() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({ status: { $ne: 'deleted' } });

        console.log(`Found ${tenants.length} tenants.`);

        for (const t of tenants) {
            // If code is missing or looks like a tenantId (starts with tenant_)
            // and it's longer than a typical short code (e.g. 10 chars)
            if (!t.code || (t.code.startsWith('tenant_') && t.code.length > 20)) {
                console.log(`Fixing code for ${t.companyName || t.name}...`);

                const companyName = t.companyName || t.name || 'cmp';
                const prefix = companyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toLowerCase() || 'cmp';

                // Find max sequence for this prefix
                const existingCodes = await Tenant.find({ code: new RegExp(`^${prefix}\\d{3}$`, 'i') }).select('code');
                let maxSeq = 0;
                for (const ext of existingCodes) {
                    const match = ext.code.match(/\d+$/);
                    if (match) {
                        const seq = parseInt(match[0], 10);
                        if (seq > maxSeq) maxSeq = seq;
                    }
                }

                const newCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
                t.code = newCode;
                await t.save();
                console.log(`Updated ${companyName} code to ${newCode}`);
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixTenants();
