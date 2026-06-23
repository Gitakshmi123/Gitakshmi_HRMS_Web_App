require('dotenv').config();
const mongoose = require('mongoose');
const { requestDocuments } = require('./controllers/applicant.controller');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const adminDb = mongoose.connection.client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    let tenantDbName;
    for (let dbInfo of dbs.databases) {
        if (dbInfo.name.startsWith('tenant_')) {
            tenantDbName = dbInfo.name;
            break;
        }
    }
    
    const db = mongoose.connection.useDb(tenantDbName);
    
    const Applicant = db.model('Applicant', require('./models/Applicant'));
    const app = await Applicant.findOne({ candidateId: { $exists: true } });
    if (!app) { console.log('No app'); process.exit(0); }
    
    // update app to Finalized to bypass validation
    app.status = 'Finalized';
    await app.save();

    const req = {
        params: { id: app._id },
        tenantDB: db,
        tenantId: app.tenant,
        user: { _id: new mongoose.Types.ObjectId() }
    };
    const res = {
        status: (code) => ({ json: (data) => console.log('Status', code, data) }),
        json: (data) => console.log('JSON', data)
    };
    
    await requestDocuments(req, res);

    const docReqSchema = require('./models/CandidateDocumentRequest');
    const CandidateDocumentRequest = db.model('CandidateDocumentRequest', docReqSchema);
    const count = await CandidateDocumentRequest.countDocuments();
    console.log('Total document requests in DB:', count);

    process.exit(0);
});
