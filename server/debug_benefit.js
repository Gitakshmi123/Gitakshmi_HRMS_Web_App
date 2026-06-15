const mongoose = require('mongoose');
require('dotenv').config();
const { getTenantDB } = require('./config/dbManager');
const benefitController = require('./controllers/benefit.controller');

// Register models for main DB
const TenantSchema = require('./models/Tenant');
const UserSchema = require('./models/User');

async function debug() {
    try {
        console.log('Connecting...');
        await mongoose.connect(process.env.MONGO_URI);

        const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
        const User = mongoose.models.User || mongoose.model('User', UserSchema);

        const tenant = await Tenant.findOne();
        if (!tenant) {
            console.error('No tenant found');
            process.exit(1);
        }

        const user = await User.findOne({ tenant: tenant._id });
        if (!user) {
            console.error('No user found for tenant:', tenant._id);
            // fallback to any user
            const anyUser = await User.findOne();
            if (!anyUser) {
                console.error('No user found at all');
                process.exit(1);
            }
        }

        const testUser = user || anyUser;
        const tenantId = tenant._id.toString();

        console.log(`Using tenant: ${tenantId}, user: ${testUser._id}`);

        const tenantDB = await getTenantDB(tenantId);

        // Mock request and response
        const req = {
            tenantDB,
            tenantId: tenantId,
            user: { _id: testUser._id, tenantId: tenantId },
            body: {
                benefitType: 'Employer PF',
                name: 'Employer PF ' + Date.now(), // Unique name
                payslipName: 'Employer PF',
                code: '',
                payType: 'FIXED',
                calculationType: 'PERCENT_OF_BASIC',
                value: 12,
                partOfSalaryStructure: true,
                isTaxable: false,
                proRata: false,
                considerForEPF: false,
                considerForESI: false,
                showInPayslip: false,
                isActive: true
            }
        };

        const res = {
            status: function (s) {
                this.statusCode = s;
                console.log('Response Status:', s);
                return this;
            },
            json: function (j) {
                console.log('Response JSON:', JSON.stringify(j, null, 2));
                return this;
            }
        };

        console.log('Calling createBenefit...');
        await benefitController.createBenefit(req, res);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Debug script failed:', err);
        process.exit(1);
    }
}

debug();
