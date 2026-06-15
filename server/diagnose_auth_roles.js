const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms';

async function diagnoseAuth() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('hrms_tenants_data');
        const Employees = db.collection('employees');

        const results = await Employees.find({
            $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }, { role: /admin/i }, { role: /hr/i }]
        }).toArray();

        console.log(`Found ${results.length} related records:`);
        results.forEach(r => {
            console.log(`- [${r._id}] Name: ${r.firstName} ${r.lastName} | Role (DB): ${r.role} | Email: ${r.email}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

diagnoseAuth();
