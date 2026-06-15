const mongoose = require('mongoose');
const idGenerator = require('./utils/idGenerator');
const getTenantDB = require('./utils/tenantDB');

async function testIdSystem() {
    try {
        console.log('🚀 Starting ID System Verification...');

        // Connect to MongoDB (assuming local dev)
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gt_hrms');
        console.log('✅ Connected to MongoDB');

        // Mock a DB object for idGenerator (simulating tenant DB)
        const db = mongoose.connection;

        // Test EMP generation (should start from 1001)
        console.log('\n--- Testing EMP ID ---');
        const empId1 = await idGenerator.generateEmployeeId(db);
        console.log('Generated EMP ID 1:', empId1);
        const empId2 = await idGenerator.generateEmployeeId(db);
        console.log('Generated EMP ID 2:', empId2);

        // Test CAND generation (should start from 0001)
        console.log('\n--- Testing CAND ID ---');
        const candId1 = await idGenerator.generateCandidateId(db);
        console.log('Generated CAND ID 1:', candId1);
        const candId2 = await idGenerator.generateCandidateId(db);
        console.log('Generated CAND ID 2:', candId2);

        // Test APP generation
        console.log('\n--- Testing APP ID ---');
        const appId1 = await idGenerator.generateApplicationId(db);
        console.log('Generated APP ID 1:', appId1);

        // Test Preview API logic
        console.log('\n--- Testing Preview Logic ---');
        const lastSeq = await idGenerator.getCurrentCounter(db, 'EMP');
        console.log('Current EMP Sequence:', lastSeq);
        const nextSeq = lastSeq + 1;
        const preview = `EMP-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
        console.log('Predicted Next EMP ID:', preview);

        console.log('\n✅ Verification Script Completed Successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Verification Failed:', err);
        process.exit(1);
    }
}

testIdSystem();
