const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    console.log('--- DB Diagnostic Start ---');
    const uri = process.env.MONGO_URI;
    console.log('URI:', uri ? 'FOUND' : 'MISSING');

    if (!uri) {
        console.error('MONGO_URI is required in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        const targetEmpId = '69a03345fe345b76edcddd55';

        // 1. Get all DB names to find tenant DBs
        const admin = mongoose.connection.db.admin();
        const { databases } = await admin.listDatabases();
        const companyDbs = databases.filter(db => db.name.startsWith('company_')).map(db => db.name);

        console.log(`Found ${companyDbs.length} company databases.`);

        for (const dbName of companyDbs) {
            console.log(`\n🔍 Checking Database: ${dbName}`);
            const db = mongoose.connection.useDb(dbName);

            // Define light schemas for searching/inspecting
            const EmployeeSchema = new mongoose.Schema({ employeeId: String, firstName: String, lastName: String }, { strict: false });
            const EmployeeModel = db.model('Employee', EmployeeSchema, 'employees');

            const emp = await EmployeeModel.findById(targetEmpId).lean();
            if (!emp) {
                console.log('  Employee not found in this DB.');
                continue;
            }
            console.log(`  ✅ Found Employee: ${emp.firstName} ${emp.lastName} (${emp.employeeId})`);

            // Check Compensation
            const collections = await db.db.listCollections().toArray();
            const collectionNames = collections.map(c => c.name);

            const checks = [
                { name: 'EmployeeCompensation', col: 'employee_compensations', fields: ['employeeId'] },
                { name: 'SalaryStructure', col: 'salarystructures', fields: ['candidateId', 'employee'] },
                { name: 'SalarySnapshot', col: 'employeesalarysnapshots', fields: ['employee'] }
            ];

            for (const check of checks) {
                if (collectionNames.includes(check.col)) {
                    const query = {
                        $or: check.fields.map(f => ({ [f]: new mongoose.Types.ObjectId(targetEmpId) }))
                    };
                    const data = await db.db.collection(check.col).find(query).toArray();
                    console.log(`  - ${check.name} (${check.col}): Found ${data.length} records.`);
                    if (data.length > 0) {
                        data.forEach(d => console.log(`    - ID: ${d._id}, Status: ${d.status}, EmployeeField: ${d.employee || d.employeeId}, CandidateField: ${d.candidateId}`));
                    }
                }
            }

            // Check linked Applicant
            const applicant = await db.db.collection('applicants').findOne({ employeeId: new mongoose.Types.ObjectId(targetEmpId) });
            if (applicant) {
                console.log(`  ✅ Found linked Applicant: ${applicant._id}`);
                const structures = await db.db.collection('salarystructures').find({ candidateId: applicant._id }).toArray();
                console.log(`    - salarystructures for Applicant: Found ${structures.length}`);
                structures.forEach(s => console.log(`      - ID: ${s._id}, Status: ${s.status}`));
            }
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('\n--- DB Diagnostic End ---');
    }
}

run();
