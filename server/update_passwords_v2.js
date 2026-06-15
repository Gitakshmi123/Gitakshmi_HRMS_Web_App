const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

        const allTenants = await Tenant.find({});
        console.log(`Checking ${allTenants.length} tenants...`);

        const defaultPass = 'admin123';
        const hashed = await bcrypt.hash(defaultPass, 10);

        for (const t of allTenants) {
            const hasPass = t.meta && t.meta.adminPassword;
            if (!hasPass) {
                const name = t.name || t.companyName || 'Unnamed';
                console.log(`🚨 Fixing: ${name} (${t._id})`);

                const meta = { ...(t.meta || {}), adminPassword: defaultPass };

                await Tenant.updateOne(
                    { _id: t._id },
                    { $set: { "meta": meta, "password": hashed } }
                );

                const email = t.adminEmail || t.companyEmail || t.meta?.primaryEmail || (name.toLowerCase().replace(/ /g, '') + '@admin.com');

                await User.findOneAndUpdate(
                    { tenant: t._id, role: 'hr' },
                    {
                        name: (t.ownerName || name),
                        email: email.trim().toLowerCase(),
                        password: hashed,
                        role: 'hr',
                        tenant: t._id
                    },
                    { upsert: true, new: true }
                );
                console.log(`   - Fixed password to: ${defaultPass} and synchronized HR user ${email}`);
            } else {
                console.log(`✅ OK: ${t.name || t.companyName}`);
            }
        }

        console.log('✅ All tenants now have valid revealable passwords.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Update failed:', err.message);
        process.exit(1);
    }
}

migrate();
