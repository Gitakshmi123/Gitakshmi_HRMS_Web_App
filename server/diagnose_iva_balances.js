const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gitakshmi-one';

async function diagnose() {
    try {
        console.log("Connecting to:", MONGO_URI);
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb('gitakshmi-one');
        const Employees = db.collection('employees');
        const LeavePolicies = db.collection('leavepolicies');
        const LeaveBalances = db.collection('leavebalances');

        // Find Iva Harpal
        const iva = await Employees.findOne({ name: /Iva/i });
        if (!iva) {
            console.log("Iva Harpal not found!");
            return;
        }

        console.log("Employee found:", {
            _id: iva._id,
            name: iva.name,
            leavePolicy: iva.leavePolicy,
            tenant: iva.tenant
        });

        if (iva.leavePolicy) {
            const policy = await LeavePolicies.findOne({ _id: iva.leavePolicy });
            console.log("Assigned Policy:", policy ? { _id: policy._id, name: policy.name, status: policy.status } : "Not found in DB!");
        }

        const balances = await LeaveBalances.find({ employee: iva._id }).toArray();
        console.log(`Balances found in DB: ${balances.length}`);
        balances.forEach(b => {
            console.log(`- Type: ${b.leaveType} | Year: ${b.year} | Available: ${b.available} | Total: ${b.total}`);
        });

        // Let's list all policies in DB
        const allPolicies = await LeavePolicies.find({}).toArray();
        console.log(`All policies in DB: ${allPolicies.length}`);
        allPolicies.forEach(p => {
            console.log(`- [${p._id}] ${p.name} | Status: ${p.status}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
