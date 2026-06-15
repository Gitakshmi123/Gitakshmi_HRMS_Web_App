const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const MONGO_URI = 'mongodb://localhost:27017/hrms';

async function seedUser() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to local MongoDB');
        
        // Models require registration if not already done
        const Tenant = mongoose.model('Tenant', require('./models/Tenant').schema || require('./models/Tenant'));
        const User = mongoose.model('User', require('./models/User').schema || require('./models/User'));
        const Role = mongoose.model('Role', require('./models/Role').schema || require('./models/Role'));

        // 1. Create Default Tenant if not exists
        let tenant = await Tenant.findOne({ code: 'GIT001' });
        if (!tenant) {
            tenant = await Tenant.create({
                companyName: 'Gitakshmi Local',
                companyEmail: 'git@gmail.com',
                adminEmail: 'git@gmail.com',
                tenantId: 'GIT001',
                code: 'GIT001',
                status: 'active',
                enabledModules: {
                    hr: true, payroll: true, attendance: true, leave: true, recruitment: true,
                    backgroundVerification: true, documentManagement: true, socialMediaIntegration: true,
                    onboarding: true, employeePortal: true, reports: true
                }
            });
            console.log('Created Tenant: GIT001');
        }

        // 2. Create User
        const email = 'git@gmail.com';
        const password = await bcrypt.hash('123456789', 10);
        
        let user = await User.findOne({ email });
        if (user) {
            user.password = password;
            user.tenant = tenant._id;
            user.mainCompanyId = tenant._id;
            user.role = 'admin'; 
            await user.save();
            console.log('Updated existing user: git@gmail.com');
        } else {
            await User.create({
                name: 'Git Admin',
                email: email,
                password: password,
                role: 'admin',
                tenant: tenant._id,
                mainCompanyId: tenant._id,
                status: 'active'
            });
            console.log('Created new user: git@gmail.com');
        }
        
        console.log('Seed completed successfully!');
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

seedUser();
