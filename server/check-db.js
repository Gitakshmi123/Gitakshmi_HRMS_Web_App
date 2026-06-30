const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0')
  .then(async () => {
    const db = mongoose.connection.useDb('company_datav');
    
    const Applicant = db.collection('applicants');
    const Application = db.collection('applications');
    const TrackerCandidate = db.collection('trackercandidates');
    
    console.log("One applicant in applicants:", await Applicant.findOne({}));
    console.log("One applicant in applications:", await Application.findOne({}));
    console.log("One trackercandidate:", await TrackerCandidate.findOne({}));
    
    const apps1 = await Applicant.find({}).toArray();
    console.log(`Total applicants: ${apps1.length}`);
    for (const a of apps1) {
        if (a.requirementId && a.requirementId.toString() === '6a388ea160e1ef7811378d17') {
           console.log(`Found applicant ${a.name} with status ${a.status}`);
        }
    }
    
    const apps2 = await Application.find({}).toArray();
    console.log(`Total applications: ${apps2.length}`);
    for (const a of apps2) {
        if (a.jobId && a.jobId.toString() === '6a388ea160e1ef7811378d17') {
           console.log(`Found application ${a.name || (a.candidateInfo && a.candidateInfo.name)} with status ${a.status}`);
           console.log(a);
        }
    }
    
    process.exit(0);
  });
