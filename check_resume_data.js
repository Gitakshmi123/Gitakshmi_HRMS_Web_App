const mongoose = require('mongoose');

// Load models
const TrackerCandidate = require('./server/models/TrackerCandidate');
const Applicant = require('./server/models/Applicant');

async function checkResumeData() {
  try {
    console.log('\n🔍 === RESUME DATA CHECK ===\n');

    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB\n');

    // Check TrackerCandidate records
    console.log('📊 === TRACKER CANDIDATES ===');
    const trackerCandidates = await TrackerCandidate.find({}).lean();
    console.log(`Total TrackerCandidates: ${trackerCandidates.length}\n`);
    
    trackerCandidates.forEach(candidate => {
      console.log(`ID: ${candidate._id}`);
      console.log(`Name: ${candidate.name}`);
      console.log(`Resume: ${candidate.resume || 'NULL'}`);
      console.log(`Resume URL: ${candidate.resumeUrl || 'NOT SET'}`);
      console.log('---');
    });

    // Check Applicant records
    console.log('\n📊 === APPLICANTS ===');
    const applicants = await Applicant.find({}).lean();
    console.log(`Total Applicants: ${applicants.length}\n`);
    
    applicants.slice(0, 10).forEach(applicant => {
      console.log(`ID: ${applicant._id}`);
      console.log(`Name: ${applicant.name}`);
      console.log(`Email: ${applicant.email}`);
      console.log(`Resume: ${applicant.resume || 'NULL'}`);
      console.log('---');
    });

    // Check if resume files exist in upload directory
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, 'server', 'uploads', 'resumes');
    
    console.log('\n📁 === UPLOADED RESUME FILES ===');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`Files in uploads/resumes: ${files.length}\n`);
      files.slice(0, 10).forEach(file => {
        console.log(`- ${file}`);
      });
      if (files.length > 10) {
        console.log(`... and ${files.length - 10} more files`);
      }
    } else {
      console.log('❌ Uploads directory does not exist');
    }

    await mongoose.disconnect();
    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkResumeData();
