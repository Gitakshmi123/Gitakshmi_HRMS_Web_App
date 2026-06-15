const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        const TenantSchema = new mongoose.Schema({}, { strict: false });
        const Tenant = mongoose.model('Tenant', TenantSchema);

        const UserSchema = new mongoose.Schema({
            name: String,
            email: String,
            password: String,
            role: String,
            tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
        }, { strict: false });
        const User = mongoose.model('User', UserSchema);

        // Find all tenants that don't have meta.adminPassword
        const tenants = await Tenant.find({
            $or: [
                { 'meta.adminPassword': { $exists: false } },
                { 'meta.adminPassword': '' },
                { 'meta.adminPassword': null }
            ]
        });

        console.log(`Found ${tenants.length} tenants requiring password recovery/reset.`);

        const defaultPass = 'admin123';
        const hashed = await bcrypt.hash(defaultPass, 10);

        for (const t of tenants) {
            const name = t.name || t.companyName || 'Unnamed';
            console.log(`Processing: ${name}`);

            const updatedMeta = { ...(t.meta || {}), adminPassword: defaultPass };

            // 1. Update Tenant
            await Tenant.findByIdAndUpdate(t._id, {
                $set: {
                    meta: updatedMeta,
                    password: hashed,
                    adminEmail: t.adminEmail || t.companyEmail || (t.meta?.primaryEmail)
                }
            });

            // 2. Ensure Admin User exists in main DB
            const email = t.adminEmail || t.companyEmail || t.meta?.primaryEmail || (name.toLowerCase() + '@admin.com');
            let adminUser = await User.findOne({ tenant: t._id, role: 'hr' });

            if (!adminUser) {
                adminUser = new User({
                    name: (t.ownerName || name),
                    email: email.trim().toLowerCase(),
                    password: hashed,
                    role: 'hr',
                    tenant: t._id
                });
                await adminUser.save();
                console.log(`- Created new admin user: ${email}`);
            } else {
                adminUser.password = hashed;
                await adminUser.save();
                console.log(`- Updated existing admin user: ${email}`);
            }
        }

        console.log('✅ Migration successfully completed.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
