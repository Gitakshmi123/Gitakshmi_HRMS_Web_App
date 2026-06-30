const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Load models
require('../app'); // requiring app registers all mongoose models

async function run() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0';
    console.log("Connecting to Database at", MONGO_URI);
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully!");

        const companyIdController = require('../controllers/companyIdConfig.controller');
        const departmentController = require('../controllers/department.controller');
        
        const CompanySettings = mongoose.model('CompanySettings');
        // Let's find one company
        const setting = await CompanySettings.findOne({});
        if (!setting) {
            console.error("No company settings found to test with!");
            process.exit(1);
        }
        const tenantId = setting.companyId;
        console.log(`Using Tenant ID: ${tenantId}`);

        // Ensure configuration is initialized for this tenant
        const getTenantDB = require('../utils/tenantDB');
        const tenantDB = await getTenantDB(tenantId);
        
        // Let's check our next ID for DEPT (increment: false)
        const nextIdResult = await companyIdController.generateIdInternal({
            tenantId,
            entityType: 'DEPT',
            increment: false
        });
        console.log("Next DEPT Code Preview:", nextIdResult);

        // Create department test
        const testDeptName = `Test Dept ${Date.now()}`;
        console.log(`Creating test department: ${testDeptName}...`);
        
        const req = {
            tenantId,
            tenantDB,
            body: {
                name: testDeptName,
                description: 'Test Department Auto Code generation',
                status: 'active'
            }
        };

        const res = {
            statusCode: 200,
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log(`Response received (code ${this.statusCode}):`, data);
            }
        };

        await departmentController.createDepartment(req, res, (err) => {
            if (err) console.error("Error creating department:", err);
        });

        // Fetch DEPT config again to see if it incremented
        const afterIdResult = await companyIdController.generateIdInternal({
            tenantId,
            entityType: 'DEPT',
            increment: false
        });
        console.log("After creation, Next DEPT Code Preview:", afterIdResult);

        // Cleanup
        const Department = tenantDB.model("Department");
        await Department.deleteOne({ name: testDeptName });
        console.log("Cleaned up test department.");

        process.exit(0);
    } catch (err) {
        console.error("Verification failed with error:", err);
        process.exit(1);
    }
}

run();
