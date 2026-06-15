const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms_tenants_data');
        console.log("Connected to Main DB");

        // The tenantId from logs was 696b2e33265b093e28c2419b
        const tenantId = '696b2e33265b093e28c2419b';
        const userId = '696b308d265b093e28c2430c';

        const getTenantDB = require('./server/utils/tenantDB');
        const db = await getTenantDB(tenantId);
        console.log("Connected to Tenant DB");

        const Employee = db.model('Employee');
        const user = await Employee.findById(userId);

        if (user) {
            console.log("--- USER DIAGNOSTIC ---");
            console.log("Name:       ", user.firstName, user.lastName);
            console.log("Email:      ", user.email);
            console.log("Role in DB: ", user.role);
            console.log("Manager:    ", user.manager);
            console.log("Tenant:     ", user.tenant);
            console.log("-----------------------");
        } else {
            console.log("USER NOT FOUND IN TENANT DB");
        }
    } catch (err) {
        console.error("DIAGNOSTIC FAILED:", err.message);
    }
    process.exit(0);
}

diagnose();
