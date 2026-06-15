/**
 * TEST SCRIPT: Generate Sample Offer Letter PDF
 * Run this to verify the PDF generation works correctly
 */

require('dotenv').config();
const letterGenerator = require('./services/letterPDFGenerator');

async function testOfferLetterGeneration() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   TESTING PROFESSIONAL OFFER LETTER PDF GENERATION         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
        // Sample candidate data
        const candidateData = {
            // Company info
            companyName: 'Gitakshmi Technologies',
            companyTagline: 'TECHNOLOGIES',
            companyAddress: 'Science City Road, Ahmedabad, Gujarat - 380051, India',
            companyPhone: '+91 79 1234 5678',
            companyEmail: 'hr@gitakshmi.com',
            companyWebsite: 'www.gitakshmi.com',
            companyCIN: 'U72900GJ2020PTC123456',

            // Reference
            refPrefix: 'GITK',
            refYear: 2025,
            refNumber: 4782,

            // Candidate details
            candidateName: 'Dharmik Jethwani',
            candidateFirstName: 'Dharmik',
            candidateSalutation: 'Mr.',
            candidateAddress: '123, Sample Address, Satellite Road',
            candidateCity: 'Ahmedabad',
            candidateState: 'Gujarat',
            candidatePincode: '380015',

            // Job details
            designation: 'MERN Stack Developer',
            department: 'Technology',
            joiningDate: '18th December 2025',
            workLocation: 'Ahmedabad',
            probationPeriod: '3 months',

            // Letter details
            letterSubject: 'Offer to Join Gitakshmi Technologies Private Limited',

            // Signatory
            signatoryName: 'Authorized Signatory',
            signatoryDesignation: 'Human Resources Manager',

            // Watermark
            watermarkText: 'CONFIDENTIAL',
            showWatermark: true
        };

        console.log('📋 Candidate Data:');
        console.log('   Name:', candidateData.candidateName);
        console.log('   Position:', candidateData.designation);
        console.log('   Location:', candidateData.workLocation);
        console.log('   Joining Date:', candidateData.joiningDate);
        console.log('');

        // Generate PDF
        const result = await letterGenerator.generatePDF(candidateData);

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ SUCCESS!                             ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        console.log('📄 PDF Generated Successfully!');
        console.log('   Filename:', result.filename);
        console.log('   Size:', (result.size / 1024).toFixed(2), 'KB');
        console.log('   Location:', result.filePath);
        console.log('   Download URL:', result.downloadUrl);
        console.log('');
        console.log('🎉 You can now open the PDF and verify the output!');
        console.log('');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testOfferLetterGeneration()
    .then(() => {
        console.log('\n✨ Test completed successfully!\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
