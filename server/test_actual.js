require('dotenv').config();
const mongoose = require('mongoose');
const { requestDocuments } = require('./controllers/applicant.controller');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const adminDb = mongoose.connection.client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    let tenantDbName;
    for (let dbInfo of dbs.databases) {
        if (dbInfo.name.startsWith('company_')) {
            tenantDbName = dbInfo.name;
            break; // Let's use the first company DB
        }
    }
    
    console.log('Using tenant DB:', tenantDbName);
    const db = mongoose.connection.useDb(tenantDbName);
    const Applicant = db.model('Applicant', require('./models/Applicant'));
    const app = await Applicant.findOne({ candidateId: { $exists: true } });
    if (!app) { console.log('No app with candidateId found'); process.exit(0); }
    
    app.status = 'Finalized';
    await app.save();

    const req = {
        params: { id: app._id },
        tenantDB: db,
        tenantId: app.tenant,
        user: { _id: new mongoose.Types.ObjectId() }
    };
    let returnedToken = null;
    const res = {
        status: (code) => ({ json: (data) => console.log('Status', code, data) }),
        json: (data) => {
            console.log('JSON success:', data.success);
            returnedToken = data.uploadPath.split('/').pop().split('?')[0];
        }
    };
    
    await requestDocuments(req, res);
    console.log('Returned Token:', returnedToken);

    process.exit(0);
});
