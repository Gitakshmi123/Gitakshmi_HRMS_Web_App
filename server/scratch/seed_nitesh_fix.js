const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_master';
        console.log('Connecting to:', mongoUri);
        await mongoose.connect(mongoUri);
        
        const tenantId = '6a01acaceb46bc6d43b11de3';
        const userId = '6a01b87cb4d610f999d87d0a';
        const email = 'nitesh@gmail.com';

        // 1. Ensure User exists in Master DB
        const User = mongoose.model('User', new mongoose.Schema({ 
            email: String, 
            tenant: mongoose.Schema.Types.ObjectId, 
            role: String,
            name: String,
            isActive: Boolean
        }, { strict: false }));

        let user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (!user) {
            console.log('Creating User in Master DB...');
            user = await User.create({
                _id: new mongoose.Types.ObjectId(userId),
                email: email,
                name: 'Nitesh Baldaniya',
                role: 'employee',
                tenant: new mongoose.Types.ObjectId(tenantId),
                isActive: true
            });
        } else {
            console.log('User already exists in Master DB');
            user.tenant = new mongoose.Types.ObjectId(tenantId);
            user.isActive = true;
            await user.save();
        }

        // 2. Ensure Employee exists in Tenant DB
        const getTenantDB = require('../utils/tenantDB');
        const tDb = await getTenantDB(tenantId);
        
        // Define a flexible Employee schema
        const EmployeeSchema = new mongoose.Schema({
            email: String,
            firstName: String,
            lastName: String,
            employeeId: String,
            status: String,
            tenant: mongoose.Schema.Types.ObjectId,
            joiningDate: Date,
            role: String
        }, { strict: false });

        const Employee = tDb.model('Employee', EmployeeSchema);
        
        let employee = await Employee.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
        if (!employee) {
            console.log('Creating Employee in Tenant DB...');
            employee = await Employee.create({
                _id: new mongoose.Types.ObjectId(userId),
                email: email,
                firstName: 'Nitesh',
                lastName: 'Baldaniya',
                employeeId: 'EMP-26-27-1000',
                status: 'ACTIVE',
                tenant: new mongoose.Types.ObjectId(tenantId),
                mainCompanyId: new mongoose.Types.ObjectId(tenantId),
                joiningDate: new Date(),
                role: 'employee'
            });

        } else {
            console.log('Employee already exists in Tenant DB');
            employee.status = 'ACTIVE';
            await employee.save();
        }

        console.log('--- SYNC COMPLETE ---');
        console.log('User ID:', user._id);
        console.log('Tenant ID:', tenantId);
        console.log('Now refresh the dashboard.');

        process.exit(0);
    } catch (err) {
        console.error('Error during seeding:', err);
        process.exit(1);
    }
}

run();
