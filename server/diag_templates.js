const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);

    const dbName = 'company_69970ece0441634957df8fb2';
    const db = mongoose.connection.useDb(dbName);

    console.log(`--- Template/Version Audit: ${dbName} ---`);

    const collectionNames = (await db.db.listCollections().toArray()).map(c => c.name);

    if (collectionNames.includes('salarytemplates')) {
        const templates = await db.db.collection('salarytemplates').find({}).toArray();
        console.log(`\n- SalaryTemplates: Found ${templates.length}`);
        templates.forEach(t => console.log(`  - ID: ${t._id}, Name: ${t.name}, IsDefault: ${t.isDefault}`));
    }

    if (collectionNames.includes('employeectcversions')) {
        const targetEmpId = '69a03345fe345b76edcddd55';
        const versions = await db.db.collection('employeectcversions').find({
            $or: [
                { employeeId: new mongoose.Types.ObjectId(targetEmpId) },
                { employee: new mongoose.Types.ObjectId(targetEmpId) }
            ]
        }).toArray();
        console.log(`\n- EmployeeCtcVersions for ${targetEmpId}: Found ${versions.length}`);
        versions.forEach(v => console.log(JSON.stringify(v, null, 2)));
    }

    await mongoose.disconnect();
}

run();
