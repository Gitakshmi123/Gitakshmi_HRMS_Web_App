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

    console.log(`--- CtcVersion Audit: ${dbName} ---`);

    const data = await db.db.collection('employee_ctc_versions').find({
        $or: [
            { employeeId: new mongoose.Types.ObjectId(targetEmpId) },
            { employee: new mongoose.Types.ObjectId(targetEmpId) }
        ]
    }).toArray();

    console.log(`\n- EmployeeCtcVersions found: ${data.length}`);
    data.forEach(v => {
        console.log(JSON.stringify(v, null, 2));
    });

    await mongoose.disconnect();
}

run();
