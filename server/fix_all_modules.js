const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function fixAllTenants() {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

        const enabledModules = {
            hr: true,
            payroll: true,
            attendance: true,
            leave: true,
            recruitment: true,
            backgroundVerification: true,
            documentManagement: true,
            socialMediaIntegration: true,
            employeePortal: true,
            reports: true
        };

        const result = await Tenant.updateMany(
            {},
            { $set: { enabledModules: enabledModules } }
        );
        console.log(`Successfully updated modules for ${result.modifiedCount} tenants.`);
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    }
}

fixAllTenants();
