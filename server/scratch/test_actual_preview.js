const mongoose = require('mongoose');
const letterController = require('../controllers/letter.controller');
const dbManager = require('../config/dbManager');

async function main() {
    try {
        const uri = "mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0";
        await mongoose.connect(uri);
        const tenantDb = dbManager.getTenantDB("6a267c694612c5f35fddd6c7", "company_pnr");
        
        const applicantId = '6a290ef1f5b907fea264f76c'; // Dhruv N Raval
        const templateId = '6a26ebc763f5d6ba8ee8f1d9'; // Correct joining letter template ID
        
        const req = {
            tenantDB: tenantDb,
            tenant: '6a267c694612c5f35fddd6c7',
            user: {
                tenantId: '6a267c694612c5f35fddd6c7',
                name: 'Test Runner'
            },
            body: {
                applicantId,
                templateId,
                refNo: 'TEST-APPT-001',
                issueDate: '2026-06-17',
                signaturePosition: 'Bottom Right',
                customData: {},
                dateFormat: 'Do MMM. YYYY'
            }
        };
        
        const res = {
            status: function(code) {
                console.log("Response status called with code:", code);
                return this;
            },
            json: function(data) {
                console.log("Response json returned data:", JSON.stringify(data, null, 2));
                return this;
            }
        };
        
        console.log("Calling previewJoiningLetter...");
        await letterController.previewJoiningLetter(req, res);
        
    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

main();
