const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0')
  .then(async () => {
    const db = mongoose.connection.useDb('company_datav');
    const Applicant = db.collection('applicants');
    
    const apps1 = await Applicant.find({}).toArray();
    for (const a of apps1) {
        console.log(`Applicant: ${a.name}, status: ${a.status}, requirementId: ${a.requirementId}`);
    }
    
    process.exit(0);
  });
