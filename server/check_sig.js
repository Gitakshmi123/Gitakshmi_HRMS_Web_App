
const mongoose = require('mongoose');
const path = require('path');

async function check() {
    try {
        const mongoUri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(mongoUri);
        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findById('6985c4f09007156530c4cb1c');
        if (!tenant) return console.log('Tenant not found');

        const dbName = `company_6985c4f09007156530c4cb1c`;
        const db = mongoose.connection.useDb(dbName);

        const GeneratedLetter = db.model('GeneratedLetter', require('./models/GeneratedLetter'));
        const Candidate = db.model('Candidate', require('./models/Candidate'));
        const SignedLetter = db.model('SignedLetter', require('./models/SignedLetter'));

        const letterId = '699444d9c5a189b20f6d09ab';
        const letter = await GeneratedLetter.findById(letterId);
        console.log('Letter Status:', letter?.status);
        console.log('Letter PDF Path:', letter?.pdfPath);

        const signedLetter = await SignedLetter.findOne({ letterId });
        console.log('SignedLetter found:', !!signedLetter);
        console.log('SignedLetter signatureImage length:', signedLetter?.signatureImage ? signedLetter.signatureImage.length : 0);

        if (letter?.applicantId) {
            const Applicant = db.model('Applicant', require('./models/Applicant'));
            const applicant = await Applicant.findById(letter.applicantId);
            if (applicant?.candidateId) {
                const candidate = await Candidate.findById(applicant.candidateId);
                console.log('Candidate Data found:', !!candidate);
                console.log('Candidate Digital Signature length:', candidate?.digitalSignature ? candidate.digitalSignature.length : 0);
            }
        }

        mongoose.connection.close();
    } catch (e) {
        console.error(e);
    }
}

check();
