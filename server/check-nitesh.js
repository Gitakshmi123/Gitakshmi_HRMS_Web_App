const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0')
  .then(async () => {
    const db = mongoose.connection.useDb('company_datav');
    const Applicant = db.collection('applicants');
    
    const nitesh = await Applicant.findOne({ name: 'Nitesh Baldaniya' });
    console.log("Nitesh details:", JSON.stringify(nitesh, null, 2));
    
    process.exit(0);
  });
