const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function fixAllLogins() {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({
            name: String,
            email: String,
            password: String,
            role: String,
            tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
        }, { strict: false }));

        const tenants = await Tenant.find({});
        console.log(`Analyzing ${tenants.length} tenants...`);

        for (const t of tenants) {
            const name = t.companyName || t.name || 'Unnamed';
            // Determine the "source of truth" email for this tenant
            const email = (t.meta?.email || t.meta?.primaryEmail || t.companyEmail || t.adminEmail || (t.code + '@hrms.com')).trim().toLowerCase();
            // Determine the "source of truth" password (PSA visible)
            const password = (t.meta?.adminPassword || 'admin123').trim();

            console.log(`Fixing: [${t.code}] ${name} | Email: ${email} | Pass: ${password}`);

            const hashedPassword = await bcrypt.hash(password, 10);

            // 1. Update the Tenant record
            await Tenant.updateOne(
                { _id: t._id },
                {
                    $set: {
                        "meta.email": email,
                        "meta.primaryEmail": email,
                        "meta.adminPassword": password,
                        "password": hashedPassword,
                        "adminEmail": email,
                        "companyEmail": email
                    }
                }
            );

            // 2. Sync user account
            // We use findOneAndUpdate with upsert to create or update the Root HR account
            await User.findOneAndUpdate(
                { tenant: t._id, role: 'hr' },
                {
                    $set: {
                        name: (t.ownerName || name),
                        email: email,
                        password: hashedPassword,
                        role: 'hr',
                        tenant: t._id
                    }
                },
                { upsert: true, new: true }
            );

            console.log(`   - Verified HR user account for ${email}`);
        }

        console.log('✅ FIXED: All tenants are now synchronized and ready for login.');
        process.exit(0);
    } catch (err) {
        console.error('❌ FIX FAILED:', err.message);
        process.exit(1);
    }
}

fixAllLogins();
