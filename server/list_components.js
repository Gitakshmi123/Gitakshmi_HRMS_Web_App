const mongoose = require('mongoose');
require('dotenv').config();

async function checkComponents() {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
        console.error('MONGO_URI not set');
        return;
    }
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const admin = mongoose.connection.useDb('admin').db.admin();
    const dbs = await admin.listDatabases();
    const companyDbs = dbs.databases.filter(d => d.name.startsWith('company_'));

    for (const dbInfo of companyDbs) {
        console.log(`Checking DB: ${dbInfo.name}`);
        const db = mongoose.connection.useDb(dbInfo.name);

        const SalaryComponentSchema = require('./models/SalaryComponent');
        const SalaryComponent = db.model('SalaryComponent', SalaryComponentSchema);

        const components = await SalaryComponent.find({ type: 'EARNING' });
        console.log('Earnings:', components.map(c => c.name));
    }

    await mongoose.disconnect();
}

checkComponents().catch(console.error);
