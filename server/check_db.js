const mongoose = require('mongoose');
require('dotenv').config();

async function checkEmployees() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gt_hrms';
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const db = mongoose.connection;
        const Employee = db.model('Employee', new mongoose.Schema({
            firstName: String,
            lastName: String,
            tenant: mongoose.Schema.Types.ObjectId,
            isActive: Boolean
        }, { strict: false }));

        const Tenant = db.model('Tenant', new mongoose.Schema({
            name: String
        }, { strict: false }));

        const tenants = await Tenant.find({}).lean();
        console.log('Tenants Count:', tenants.length);
        console.log('Tenants:', tenants.map(t => ({ id: t._id, name: t.name })));

        const employees = await Employee.find({}).limit(10).lean();
        console.log('Employees Count:', await Employee.countDocuments({}));
        console.log('Sample Employees:', employees.map(e => ({
            name: `${e.firstName} ${e.lastName}`,
            tenant: e.tenant,
            isActive: e.isActive
        })));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkEmployees();
