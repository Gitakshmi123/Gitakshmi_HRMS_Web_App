const mongoose = require('mongoose');
require('dotenv').config();

async function repair() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms_tenants_data');
        console.log("Connected to Main DB");

        const tenantId = '696b2e33265b093e28c2419b';
        const userId = '696b308d265b093e28c2430c';
        const requestId = '696dd7deec637b4c16ec7f1e';

        const getTenantDB = require('./utils/tenantDB');
        const db = await getTenantDB(tenantId);
        console.log("Connected to Tenant DB");

        const Employee = db.model('Employee');
        const LeaveRequest = db.model('LeaveRequest');

        // 1. Check User
        const user = await Employee.findById(userId);
        if (user) {
            console.log(`Current User: ${user.firstName} ${user.lastName}, Role: ${user.role}`);
            if (user.role.trim().toLowerCase() === 'employee') {
                console.log("UPGRADING USER TO ADMIN...");
                user.role = 'Admin';
                await user.save();
                console.log("User upgraded successfully.");
            }
        } else {
            console.log("User not found.");
        }

        // 2. Check Request
        const request = await LeaveRequest.findById(requestId);
        if (request) {
            console.log(`Request Info: Applicant ID: ${request.employee}, Status: ${request.status}`);
            const applicant = await Employee.findById(request.employee);
            if (applicant) {
                console.log(`Applicant: ${applicant.firstName} ${applicant.lastName}, Manager: ${applicant.manager}`);
                if (applicant.manager && applicant.manager.toString() === userId.toString()) {
                    console.log("User is already the manager of this applicant.");
                } else {
                    console.log("User is NOT the manager of this applicant.");
                }
            }
        } else {
            console.log("Request not found.");
        }

    } catch (err) {
        console.error("REPAIR FAILED:", err);
    }
    process.exit(0);
}

repair();
