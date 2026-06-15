const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

async function listAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({ status: { $ne: 'deleted' } }, 'companyName code tenantId');

        let output = '--- Current Companies in DB ---\n';
        tenants.forEach(t => {
            output += `Company: ${t.companyName}\n`;
            output += `Code:    ${t.code}\n`;
            output += `ID:      ${t.tenantId}\n`;
            output += '----------------------------\n';
        });

        fs.writeFileSync('db_results.txt', output);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listAll();
