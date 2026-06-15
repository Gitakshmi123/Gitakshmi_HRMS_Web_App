const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Tenant = require('./models/Tenant');

async function enableModules() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const result = await Tenant.updateOne(
            { code: 'GIT001' },
            {
                $set: {
                    'enabledModules.hr': true,
                    'enabledModules.payroll': true,
                    'enabledModules.attendance': true,
                    'enabledModules.leave': true,
                    'enabledModules.recruitment': true,
                    'enabledModules.backgroundVerification': true,
                    'enabledModules.documentManagement': true,
                    'enabledModules.socialMediaIntegration': true,
                    'enabledModules.onboarding': true,
                    'enabledModules.employeePortal': true,
                    'enabledModules.reports': true
                }
            }
        );
        
        console.log('Update Result:', result);
        
        const updated = await Tenant.findOne({ code: 'GIT001' }).select('enabledModules');
        console.log('Updated Modules:', updated.enabledModules);
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

enableModules();
