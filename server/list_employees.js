const mongoose = require('mongoose');
require('dotenv').config();

// Attempt to read from process env if available, else default
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms_saas_db';

async function listAll() {
    try {
        console.log('Connecting to:', MONGO_URI);
        await mongoose.connect(MONGO_URI);

        const db = mongoose.connection.db;
        const Employees = db.collection('employees');

        const all = await Employees.find({}).toArray();
        console.log(`Total Employees: ${all.length}`);

        all.forEach(e => {
            console.log(`- [${e._id}] ${e.firstName} ${e.lastName} | Email: ${e.email} | Policy: ${e.leavePolicy}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listAll();
