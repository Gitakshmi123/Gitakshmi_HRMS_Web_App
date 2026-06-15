const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    const uri = process.env.MONGO_URI;
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB (Global)');

        const targetEmpId = '69a03345fe345b76edcddd55';

        // Use raw collection access to be 100% sure we see everything
        const db = mongoose.connection.db;
        const structures = await db.collection('salarystructures').find({
            $or: [
                { employee: new mongoose.Types.ObjectId(targetEmpId) },
                { candidateId: new mongoose.Types.ObjectId(targetEmpId) },
                { tenantId: '69970ece0441634957df8fb2' } // Search by tenant to see ANY records
            ]
        }).toArray();

        console.log(`\n- Global SalaryStructures found: ${structures.length}`);
        structures.forEach(s => {
            console.log(`  - ID: ${s._id}, Emp: ${s.employee}, Cand: ${s.candidateId}, Status: ${s.status}, Tenant: ${s.tenantId}`);
        });

        if (structures.length === 0) {
            // Check broadly for ANY structures
            const count = await db.collection('salarystructures').countDocuments();
            console.log(`\nTotal structures in global DB: ${count}`);
            if (count > 0) {
                const sample = await db.collection('salarystructures').findOne({});
                console.log('Sample structure:', JSON.stringify(sample, null, 2));
            }
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
