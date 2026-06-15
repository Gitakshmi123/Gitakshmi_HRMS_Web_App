const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);

    const targetEmpId = '69a03345fe345b76edcddd55';
    const dbName = 'company_69970ece0441634957df8fb2';
    const db = mongoose.connection.useDb(dbName);

    console.log(`--- Deep Audit: ${dbName} ---`);

    // 1. Inspect full Employee document
    const emp = await db.db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(targetEmpId) });
    console.log('\n--- Employee Document ---');
    console.log(JSON.stringify(emp, null, 2));

    // 2. Check SalaryAssignment
    const assignments = await db.db.collection('salaryassignments').find({ employeeId: new mongoose.Types.ObjectId(targetEmpId) }).toArray();
    console.log(`\n- SalaryAssignment: Found ${assignments.length}`);
    assignments.forEach(a => console.log(JSON.stringify(a, null, 2)));

    // 3. Check for ANY SalaryStructure in the DB (just to see a sample)
    const samples = await db.db.collection('salarystructures').find({}).limit(5).toArray();
    console.log(`\n- SalaryStructure Samples (Total in DB: ${await db.db.collection('salarystructures').countDocuments()}):`);
    samples.forEach(s => console.log(`  - ID: ${s._id}, Emp: ${s.employee}, Cand: ${s.candidateId}, Status: ${s.status}`));

    // 4. Check for ANY EmployeeCompensation in the DB
    const compSamples = await db.db.collection('employee_compensations').find({}).limit(5).toArray();
    console.log(`\n- EmployeeCompensation Samples (Total in DB: ${await db.db.collection('employee_compensations').countDocuments()}):`);
    compSamples.forEach(c => console.log(`  - ID: ${c._id}, Emp: ${c.employeeId}, Status: ${c.status}`));

    await mongoose.disconnect();
}

run();
