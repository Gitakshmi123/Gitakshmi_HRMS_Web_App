const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function fixMods() {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
        const id = '69ae76d0d0a86653c8f75c29'; // TEC001

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

        const result = await Tenant.findByIdAndUpdate(id, { $set: { enabledModules: enabledModules } }, { new: true });
        console.log('Update Result:', JSON.stringify(result.enabledModules, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    }
}

fixMods();
