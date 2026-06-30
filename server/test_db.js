const mongoose = require('mongoose');
const getTenantDB = require('./utils/tenantDB');

mongoose.connect('mongodb://127.0.0.1:27017/hrms_saas');
const db = mongoose.connection;
db.once('open', async () => {
  try {
    const tenantDB = await getTenantDB('66a218f0a0e9803157f49514');
    const Applicant = tenantDB.model('Applicant', require('./models/Applicant'));
    const ExternalRecord = tenantDB.model('ExternalEmployeeRecord', require('./models/ExternalEmployeeRecord'));
    
    const applicants = await Applicant.find({}).sort({ createdAt: -1 }).limit(5);
    console.log('Recent Applicants:');
    applicants.forEach(a => console.log(`- ${a.name} (${a.email}): Status=${a.status}, DocReqStatus=${a.documentRequestStatus}, employeeId=${a.employeeId}`));
    
    const records = await ExternalRecord.find({}).sort({ createdAt: -1 }).limit(5);
    console.log('\nRecent External Records:');
    records.forEach(r => console.log(`- ID=${r._id}, ApplicantId=${r.applicantId}, Status=${r.status}`));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
