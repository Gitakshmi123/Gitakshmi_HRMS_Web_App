const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_master');
        console.log('Connected to Master DB');

        const tenantId = '6a01acaceb46bc6d43b11de3';
        const email = 'nitesh@gmail.com';

        // 1. Check User in Master DB
        const User = mongoose.model('User', new mongoose.Schema({ email: String, tenant: mongoose.Schema.Types.ObjectId, role: String }));
        const user = await User.findOne({ email });
        console.log('User in Master DB:', user ? JSON.stringify(user, null, 2) : 'NOT FOUND');

        // 2. Check Employee in Tenant DB
        const getTenantDB = require('../utils/tenantDB');
        const tDb = await getTenantDB(tenantId);
        const Employee = tDb.model('Employee', new mongoose.Schema({ email: String, firstName: String, lastName: String }));
        const employee = await Employee.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        console.log('Employee in Tenant DB:', employee ? JSON.stringify(employee, null, 2) : 'NOT FOUND');

        // 3. Check All Employees in Tenant DB (to see if any exist)
        const allEmps = await Employee.find({}).limit(5).lean();
        console.log('Sample Employees in Tenant DB:', allEmps.map(e => e.email));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
