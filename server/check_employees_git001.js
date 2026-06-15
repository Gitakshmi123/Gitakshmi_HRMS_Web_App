const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Tenant = require('./models/Tenant');
const getTenantDB = require('./utils/tenantDB');

async function checkEmployees() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const tenant = await Tenant.findOne({ code: 'GIT001' });
        if (!tenant) {
            console.log('Tenant GIT001 not found');
            return;
        }
        
        const tenantDB = await getTenantDB(tenant._id);
        const Employee = tenantDB.model('Employee');
        
        const emps = await Employee.find({ 
            $or: [
                { tenant: tenant._id },
                { tenant: { $exists: false } },
                { tenant: null }
            ]
        });
        
        console.log(`Found ${emps.length} employees for tenant ${tenant.code}`);
        emps.forEach(e => {
            console.log(`- ${e.firstName} ${e.lastName} (Email: ${e.email})`);
        });
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkEmployees();
