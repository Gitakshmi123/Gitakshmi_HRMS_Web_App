const mongoose = require('mongoose');

async function verifyRegistration() {
    console.log('🚀 Starting Model Registration Verification...');

    // 1. Check Global Registration
    console.log('\n--- Checking Global Mongoose Instance ---');
    try {
        const modelNames = mongoose.modelNames();
        if (modelNames.includes('SalaryStructure')) {
            console.log('✅ SalaryStructure is registered on global mongoose instance');
        } else {
            console.warn('⚠️ SalaryStructure NOT found on global mongoose instance');
        }
    } catch (e) {
        console.error('❌ Error checking global models:', e.message);
    }

    // 2. Check Schema Definition
    console.log('\n--- Checking Schema Definition ---');
    try {
        const SalaryStructureSchema = require('./models/SalaryStructure');
        const schema = SalaryStructureSchema.schema || SalaryStructureSchema;
        const paths = Object.keys(schema.paths);

        const requiredFields = ['employee', 'candidateId', 'status', 'effectiveFrom'];
        requiredFields.forEach(field => {
            if (paths.includes(field)) {
                console.log(`✅ Field '${field}' exists in schema`);
            } else {
                console.error(`❌ Field '${field}' MISSING from schema!`);
            }
        });
    } catch (e) {
        console.error('❌ Error checking schema:', e.message);
    }

    console.log('\n--- Verification Finished ---');
    process.exit(0);
}

verifyRegistration();
