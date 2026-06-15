const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

        const allTenants = await Tenant.find({});
        console.log(`Final sync for ${allTenants.length} tenants...`);

        const defaultPass = 'admin123';
        const hashed = await bcrypt.hash(defaultPass, 10);

        for (const t of allTenants) {
            const name = t.name || t.companyName || 'Unnamed';

            // Source of truth email
            let email = (t.companyEmail || t.adminEmail || t.meta?.primaryEmail || t.meta?.email || (t.code + '@hrms.com')).trim().toLowerCase();

            // Source of truth password
            let pass = (t.meta?.adminPassword || 'admin123').trim();
            if (!pass || pass === 'undefined') pass = defaultPass;

            console.log(`✅ [${t.code}] Syncing: ${email} / ${pass}`);

            const meta = {
                ...(t.meta || {}),
                adminPassword: pass,
                primaryEmail: email,
                email: email
            };

            const currentHashed = await bcrypt.hash(pass, 10);

            await Tenant.updateOne(
                { _id: t._id },
                {
                    $set: {
                        "meta": meta,
                        "password": currentHashed,
                        "adminEmail": email,
                        "companyEmail": email
                    }
                }
            );
        }

        console.log('✅ Final data synchronization finished. All logins are now active.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
        process.exit(1);
    }
}

migrate();
