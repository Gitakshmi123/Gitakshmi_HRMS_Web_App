const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hrms_saas_db';

async function verifyPolicy() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        // 1. Find the User (Harsh Shah) - Assuming tenant context might be tricky in raw script, 
        // but let's try to find by name across all tenants or just the valid one.
        // We know the tenant DB pattern if we are using robust multi-tenancy, but let's look at the "Employee" model in the main DB first?
        // Wait, the app seems to use `req.tenantDB`. 
        // Let's assume for now we are checking the main database or we need to find the tenant.

        // Let's just look for "Harsh" in the 'employees' collection if it exists in the main DB, 
        // OR we might need to look at how the app connects.
        // Usually, in these setups, there's a main DB and maybe tenant DBs, OR one DB with tenantId.

        // Let's list collections first to be sure where to look.
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        console.log('Collections:', collectionNames);

        // Try to find LeavePolicy and Employee
        let Employee;
        let LeavePolicy;

        // Basic schema definition for querying
        const empSchema = new mongoose.Schema({}, { strict: false });
        const policySchema = new mongoose.Schema({}, { strict: false });

        if (collectionNames.includes('employees')) {
            Employee = mongoose.model('Employee', empSchema, 'employees');
        }
        if (collectionNames.includes('leavepolicies')) {
            LeavePolicy = mongoose.model('LeavePolicy', policySchema, 'leavepolicies');
        }

        if (Employee) {
            const harsh = await Employee.findOne({ $or: [{ firstName: /Harsh/i }, { lastName: /Shah/i }] });
            if (harsh) {
                console.log('\n--- Employee Found ---');
                console.log('ID:', harsh._id);
                console.log('Name:', harsh.firstName, harsh.lastName);
                console.log('LeavePolicy Field:', harsh.leavePolicy);
                console.log('Tenant:', harsh.tenant);

                if (LeavePolicy) {
                    const policies = await LeavePolicy.find({ tenant: harsh.tenant });
                    console.log('\n--- Available Policies for Tenant ---');
                    policies.forEach(p => {
                        console.log(`- Policy ID: ${p._id}`);
                        console.log(`  Name: ${p.policyName}`);
                        console.log(`  Applicable To: ${p.applicableTo}`);
                    });

                    if (!harsh.leavePolicy && policies.length > 0) {
                        console.log('\n[DIAGNOSIS]: Employee has NO policy assigned, but policies exist.');
                    } else if (harsh.leavePolicy) {
                        console.log('\n[DIAGNOSIS]: Employee HAS policy assigned.');
                        const assigned = policies.find(p => p._id.toString() === harsh.leavePolicy.toString());
                        console.log(`  Assigned Policy Name: ${assigned ? assigned.policyName : 'UNKNOWN (ID mismatch)'}`);
                    } else {
                        console.log('\n[DIAGNOSIS]: Employee has NO policy and NO policies exist for tenant.');
                    }
                }
            } else {
                console.log('User "Harsh" not found in employees collection.');
            }
        } else {
            console.log('Employees collection not found.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

verifyPolicy();
