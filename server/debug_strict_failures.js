require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { generateJoiningLetter } = require('./controllers/letter.controller');
const ApplicantSchema = require('./models/Applicant');
const Applicant = mongoose.models.Applicant || mongoose.model('Applicant', ApplicantSchema);
const LetterTemplate = require('./models/LetterTemplate');
const RequirementSchema = require('./models/Requirement');
const Requirement = mongoose.models.Requirement || mongoose.model('Requirement', RequirementSchema);

const log = console.log;

// Mock Req/Res
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.data = null;
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const runDebug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        log('✅ DB Connected');

        // 1. Find a Template
        // 1. Find a Template (Prioritize "GTPL2" as per user screenshot)
        let template = await LetterTemplate.findOne({ name: 'GTPL2' });
        if (!template) {
            log('⚠️ "GTPL2" not found, falling back to any joining template.');
            template = await LetterTemplate.findOne({ type: 'joining' });
        }
        if (!template) throw new Error('No joining template found');

        log(`Using Template: "${template.name}" (ID: ${template._id})`);
        log(`Template File Path: ${template.filePath}`);

        // CHECK IF FILE EXISTS
        // CHECK IF FILE EXISTS
        const fs = require('fs');
        const path = require('path');

        if (!template.filePath) {
            log('⚠️ DEBUG CHECK DETECTED: template.filePath is missing/null!');
        } else {
            // mimic controller path resolution
            const resolvedPath = path.resolve(template.filePath);
            log(`Resolved Path: ${resolvedPath}`);

            if (!fs.existsSync(resolvedPath)) {
                log('❌ CRITICAL ERROR: Template file does not exist at resolved path!');
                // We want to see if this is the cause, but let's continue to let the controller fail naturally if we can
            } else {
                log('✅ Template file exists.');
            }
        }

        // 2. CREATE DUMMY APPLICANT
        log('Creating dummy applicant for debugging...');
        const dummyApplicant = await Applicant.create({
            name: 'Debug User',
            email: `debug_${Date.now()}@test.com`,
            mobile: '5555555555',
            experience: '2',
            requirementId: new mongoose.Types.ObjectId(),
            status: 'Selected',
            offerLetterPath: 'offers/mock_debug_offer.pdf' // FAKE OFFER PATH
        });

        const realApplicant = dummyApplicant;
        log(`Created Dummy Applicant: ${realApplicant._id}`);
        log('Offer Path:', realApplicant.offerLetterPath);

        // Simulate Request
        const req = {
            user: { tenantId: template.tenantId, userId: new mongoose.Types.ObjectId().toString() },
            body: {
                applicantId: realApplicant._id,
                templateId: template._id,
                customData: {
                    joiningDate: '2025-01-01',
                    EMPLOYEE_NAME: 'Test Name',
                    DESIGNATION: 'Dev'
                }
            }
        };
        const res = mockRes();
        await generateJoiningLetter(req, res);

        if (res.statusCode !== 200) {
            log('❌ FAILURE on Real Applicant:', res.statusCode, JSON.stringify(res.data));
        } else {
            log('✅ SUCCESS on Real Applicant. Path:', res.data.pdfPath);
        }

        // Cleanup
        await Applicant.findByIdAndDelete(dummyApplicant._id);
        log('Cleaned up dummy applicant');

    } catch (e) {
        console.error('DEBUG ERROR:', e);
    } finally {
        mongoose.connection.close();
    }
};

runDebug();
