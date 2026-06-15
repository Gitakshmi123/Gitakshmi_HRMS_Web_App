const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    console.log('✅ Connected to GLOBAL MongoDB');

    const targetEmpId = '69a03345fe345b76edcddd55';
    // The main DB is from the URI (usually 'hrms' or similar)
    const db = mongoose.connection;

    console.log(`--- Global Collection Audit ---`);
    const SalaryStructureSchema = require('./models/SalaryStructure');
    // Ensure we are using the global model
    const SalaryStructureGlobal = mongoose.models.SalaryStructure || mongoose.model('SalaryStructure', SalaryStructureSchema);

    // Check by employee OR candidateId
    // We don't have the candidateId yet, but let's check by employee ID first
    const results = await SalaryStructureGlobal.find({
        $or: [
            { employee: new mongoose.Types.ObjectId(targetEmpId) },
            { candidateId: new mongoose.Types.ObjectId(targetEmpId) }
        ]
    }).lean();

    console.log(`\n- Global SalaryStructures found: ${results.length}`);
    results.forEach(r => {
        console.log(JSON.stringify(r, null, 2));
    });

    // Let's also search broadly by ANY field in this collection just in case
    const all = await SalaryStructureGlobal.find({}).limit(10).lean();
    console.log(`\n- Total Global Records: ${await SalaryStructureGlobal.countDocuments()}`);

    await mongoose.disconnect();
}

run();
