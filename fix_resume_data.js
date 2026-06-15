const mongoose = require('mongoose');
const path = require('path');

async function fixResumeData() {
    try {
        const mongoUrl = process.env.MONGO_URI || 'mongodb+srv://hansatanna1109_db_user:hrms2026@hrms.s4kheoe.mongodb.net/hrms?retryWrites=true&w=majority';
        await mongoose.connect(mongoUrl);

        console.log('✅ Connected to MongoDB\n');

        // Get the actual resume file from disk
        const fs = require('fs');
        const uploadsDir = path.join(__dirname, 'server', 'uploads', 'resumes');
        
        if (!fs.existsSync(uploadsDir)) {
            console.log('❌ Uploads directory not found');
            process.exit(1);
        }

        const files = fs.readdirSync(uploadsDir);
        const resumeFiles = files.filter(f => f.endsWith('.pdf'));
        
        console.log(`📁 Found ${resumeFiles.length} resume files:`);
        resumeFiles.forEach(f => console.log(`   - ${f}`));

        if (resumeFiles.length === 0) {
            console.log('❌ No resume files found');
            process.exit(1);
        }

        // Get the first (and likely only) resume file
        const correctResumeFile = resumeFiles[0];
        
        // Update all TrackerCandidate records to point to this file
        const TrackerCandidate = mongoose.model('TrackerCandidate', require('./server/models/TrackerCandidate').schema);
        
        console.log(`\n🔄 Updating all TrackerCandidates to use: ${correctResumeFile}`);
        
        const result = await TrackerCandidate.updateMany(
            { resume: { $exists: false } },
            { $set: { resume: correctResumeFile } }
        );

        console.log(`✅ Updated ${result.modifiedCount} documents`);

        await mongoose.disconnect();
        console.log('\n✅ Fix complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixResumeData();
