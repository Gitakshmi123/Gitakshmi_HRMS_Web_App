const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
        // No User model for now to avoid collection creation issues

        const allTenants = await Tenant.find({});
        console.log(`Checking ${allTenants.length} tenants...`);

        const defaultPass = 'admin123';
        const hashed = await bcrypt.hash(defaultPass, 10);

        for (const t of allTenants) {
            const hasPass = t.meta && t.meta.adminPassword;
            if (!hasPass) {
                const name = t.name || t.companyName || 'Unnamed';
                console.log(`🚨 Fixing Metadata for: ${name}`);

                const meta = { ...(t.meta || {}), adminPassword: defaultPass };

                await Tenant.updateOne(
                    { _id: t._id },
                    { $set: { "meta": meta, "password": hashed } }
                );
                console.log(`   - Set password to: ${defaultPass}`);
            } else {
                console.log(`✅ OK: ${t.name || t.companyName}`);
            }
        }

        console.log('✅ Tenant metadata fixed. Labels should now show dots/passwords.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Update failed:', err.message);
        process.exit(1);
    }
}

migrate();
