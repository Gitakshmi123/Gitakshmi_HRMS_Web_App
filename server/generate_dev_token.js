/**
 * generate_dev_token.js
 * Run with: node generate_dev_token.js
 *
 * Connects to MongoDB, finds the first active tenant, and prints a fresh
 * HR dev token (30-day expiry) to paste into client/.env as VITE_DEV_HR_TOKEN.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');

const MONGO_URI   = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
const JWT_SECRET  = process.env.JWT_SECRET || 'hrms_secret_key_123';
const EXPIRY_DAYS = 30;

async function main() {
    try {
        await mongoose.connect(MONGO_URI, { family: 4 });
        console.log('✅ Connected to MongoDB');

        const Tenant = require('./models/Tenant');

        // Try to find active tenant; fall back to any tenant
        console.log('🔍 Looking for tenants...');
        let tenant = await Tenant.findOne({ status: 'active' }).lean();
        if (!tenant) {
            console.log('⚠️ No active tenant, searching for any tenant...');
            tenant = await Tenant.findOne({}).lean();
        }

        if (!tenant) {
            console.error('❌ No tenants found in the database.');
            console.log('\nGenerating a PLACEHOLDER token (no real tenantId)...');
            tenant = { _id: 'DEV_PLACEHOLDER', code: 'dev', meta: { email: 'dev@hrms.com' } };
        } else {
            console.log('✅ Found tenant:', tenant.code);
        }

        const email = tenant.meta?.email || tenant.adminEmail || 'dev@hrms.com';

        const payload = {
            id:          tenant._id.toString(),
            email,
            role:        'hr',
            companyCode: tenant.code,
            tenantId:    tenant._id.toString(),
        };

        console.log('🔑 Signing token...');
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${EXPIRY_DAYS}d` });
        console.log('🔑 Token generated!');

        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000).toLocaleString();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Tenant : ${tenant.code} (${tenant._id})`);
        console.log(`✅ Email  : ${email}`);
        console.log(`✅ Expiry : ${expiresAt}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\nTOKEN_START');
        console.log(token);
        console.log('TOKEN_END\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
