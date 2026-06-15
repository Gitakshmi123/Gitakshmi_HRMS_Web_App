require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const dbManager = require('./config/dbManager');
  const tenantDB = await dbManager.getTenantDB('69d626068560596a949a0010');
  const Applicant = tenantDB.model('Applicant', require('./models/Applicant'));
  const Candidate = tenantDB.model('Candidate', require('./models/Candidate'));
  
  const id = '69dcecbd2d0116ce9ac722d1';
  const profile = await Candidate.findById(id);
  console.log('Profile Email:', profile.email);
  
  const apps = await Applicant.find({ 
    $or: [
        { candidateId: id }, 
        { email: profile.email?.toLowerCase() }
    ] 
  }).populate('requirementId');
  
  console.log('Apps Found:', apps.length);
  process.exit(0);
}).catch(console.error);
