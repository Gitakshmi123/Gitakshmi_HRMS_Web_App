const mongoose = require('mongoose');
require('dotenv').config();
const { getTenantDB } = require('./config/dbManager');
const { getBGVModels } = require('./utils/bgvModels');

async function test() {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    // Simulate req
    const req = { tenantId: 'company_pnr', headers: { 'x-tenant-id': 'company_pnr' } };
    
    // Use same logic as getAllCases
    const { BGVCase } = await getBGVModels(req);
    
    const cases = await BGVCase.find({ tenant: req.tenantId })
        .populate({
            path: 'applicationId',
            select: 'name email mobile requirementId',
            populate: {
                path: 'requirementId',
                select: 'jobOpeningId jobTitle'
            }
        }).lean();
        
    console.log("Found cases:", cases.length);
    if (cases.length > 0) {
        console.log("applicationId:", cases[0].applicationId);
        console.log("candidateId:", cases[0].candidateId);
        console.log("employeeId:", cases[0].employeeId);
    }
    
    mongoose.disconnect();
}

test().catch(console.error);
