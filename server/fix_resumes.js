#!/usr/bin/env node

/**
 * Direct database update script to fix resume paths
 * Updates candidates to point to actual resume files
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function fixResumes() {
    try {
        const mongoUrl = 'mongodb+srv://hansatanna1109_db_user:hrms2026@hrms.s4kheoe.mongodb.net/hrms?retryWrites=true&w=majority';
        
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(mongoUrl, {
            serverSelectionTimeoutMS: 5000
        });

        console.log('✅ Connected\n');

        // Load models
        const TrackerCandidateSchema = require('./models/TrackerCandidate');
        const ApplicantSchema = require('./models/Applicant');
        
        const TrackerCandidate = mongoose.model('TrackerCandidate', TrackerCandidateSchema.schema || TrackerCandidateSchema);
        const Applicant = mongoose.model('Applicant', ApplicantSchema.schema || ApplicantSchema);

        // Get actual resume files
        const uploadsDir = path.join(__dirname, 'uploads', 'resumes');
        const resumeFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
        
        if (resumeFiles.length === 0) {
            console.log('❌ No resume files found in uploads directory');
            process.exit(1);
        }

        const correctResume = resumeFiles[0];
        console.log(`📁 Found resume file: ${correctResume}\n`);

        // Find and update all candidates
        console.log('🔍 Finding candidates with missing/wrong resume...');
        
        let candidates = await TrackerCandidate.find({}).lean();
        console.log(`Found ${candidates.length} TrackerCandidates`);
        
        if (candidates.length === 0) {
            console.log('Trying Applicant model...');
            candidates = await Applicant.find({}).lean();
            console.log(`Found ${candidates.length} Applicants`);
        }

        // Update each candidate
        let updated = 0;
        const Model = candidates.length > 0 && candidates[0].hasOwnProperty('resume') ? 
            (candidates[0]._id.toString().startsWith('ObjectId') ? TrackerCandidate : Applicant) : 
            TrackerCandidate;
            
        console.log(`\nUpdating using ${Model.modelName} model\n`);
        
        for (const candidate of candidates) {
            if (!candidate.resume || !fs.existsSync(path.join(uploadsDir, candidate.resume))) {
                console.log(`📝 Updating: ${candidate.name || 'Unknown'} (${candidate._id})`);
                console.log(`   Old resume: ${candidate.resume || 'NULL'}`);
                console.log(`   New resume: ${correctResume}`);
                
                await Model.findByIdAndUpdate(
                    candidate._id,
                    { $set: { resume: correctResume } }
                );
                updated++;
            }
        }

        console.log(`\n✅ Updated ${updated} candidates`);

        await mongoose.disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixResumes();
