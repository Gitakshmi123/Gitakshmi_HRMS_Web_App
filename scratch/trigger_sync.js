const mongoose = require('mongoose');
const leaveManagementService = require('./server/services/leaveManagement.service');
const dbManager = require('./server/config/dbManager');

// Mock req for dbManager/models
const req = {
    tenantId: 'GIT001', // Based on screenshot "GitakshmiHR" code might be GIT001? Or I should find it.
    tenantDB: null // Will be set
};

async function test() {
    try {
        // Connect to MongoDB (assuming local or env)
        await mongoose.connect('mongodb://localhost:27017/GT_HRMS'); // Update if needed
        
        // Find the employee
        const employeeId = '69f98d1140c0839058c0254a';
        
        // We need the tenant ID. Let's find it from the employee.
        const db = mongoose.connection;
        const Employee = db.model('Employee', new mongoose.Schema({ tenant: mongoose.Schema.Types.ObjectId, employeeId: String, leavePolicy: mongoose.Schema.Types.ObjectId }));
        const emp = await Employee.findById(employeeId);
        
        if (!emp) {
            console.error('Employee not found');
            return;
        }

        console.log('Testing sync for employee:', emp.employeeId);
        
        // Mock the tenant DB logic
        // In real app, it uses tenant-specific DB.
        // For testing, I'll just use the current connection if it has the models.
        
        // Actually, it's easier to just trigger it via a small script that I run via 'node'.
    } catch (e) {
        console.error(e);
    }
}

// I'll wait for the user to just click save in the UI, as it's safer than me trying to connect to their DB.
