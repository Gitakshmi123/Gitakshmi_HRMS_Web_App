const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0')
  .then(async () => {
    const db = mongoose.connection.useDb('company_datav');
    const Applicant = db.collection('applicants');
    
    // Find applicants for the job shown in the screenshot
    const applicants = await Applicant.find({ requirementId: new mongoose.Types.ObjectId('6a388ea160e1ef7811378d17') }).toArray();
    
    console.log(`Found ${applicants.length} applicants`);
    for (const app of applicants) {
      console.log(`Applicant: ${app.name}`);
      console.log(`  _id: ${app._id}`);
      console.log(`  status: "${app.status}"`);
      console.log(`  currentStage:`, app.currentStage);
      console.log(`  candidateId:`, app.candidateId);
      console.log('---');
    }
    process.exit(0);
  });
