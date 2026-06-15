const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const Tenant = require('./server/models/Tenant');
const CounterSchema = require('./server/models/Counter');
const EmployeeSchema = require('./server/models/Employee');

// Mock request/response objects
const mockReq = {
    tenantId: null, // Will be filled
    tenantDB: null, // Will be filled
    body: {
        firstName: "Test",
        lastName: "User",
        department: "Tech"
    }
};

const mockRes = {
    json: (data) => console.log("Response JSON:", data),
    status: (code) => ({
        json: (data) => console.log(`Response Status ${code}:`, data)
    })
};

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Use the first tenant found
        const tenant = await Tenant.findOne();
        if (!tenant) {
            console.error("No tenant found");
            process.exit(1);
        }
        console.log("Using Tenant:", tenant.name, tenant._id);
        mockReq.tenantId = tenant._id.toString();

        // Setup Tenant DB connection mock (reusing logic from controller if possible, or just mocking what getModels needs)
        // In the controller, getModels(req) uses req.tenantDB.
        // We need to simulate the tenant DB connection or modify how we call the controller.
        // However, for preview, it mainly uses 'Counter' which the controller says:
        // "Counter is now global, not per-tenant" (lines 30, and getGlobalCounter logic)
        // But getModels also returns Employee.
        
        // Let's create a connection to the tenant DB if needed, or just the main DB if that's how it's set up.
        // Assuming single DB for now based on previous context, or we can try to mock req.tenantDB as mongoose.connection if it's the same.
        mockReq.tenantDB = mongoose.connection; 

        // Load Controller
        const empCtrl = require('./server/controllers/hr.employee.controller');

        console.log("Calling preview with:", mockReq.body);
        await empCtrl.preview(mockReq, mockRes);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
