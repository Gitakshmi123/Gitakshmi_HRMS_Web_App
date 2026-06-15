
const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const service = require('./services/Recruitment.service');
        const tenantId = '69f8ce66319fbe2bc13704ca'; // dha001
        
        const result = await service.getTenantApplications(tenantId);
        console.log('--- RESULT ---');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
