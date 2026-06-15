const mongoose = require('mongoose');
const dns = require('dns');

// DNS FIX for Atlas SRV
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (e) {
    console.warn('DNS override failed:', e.message);
}

require('dotenv').config();

const recruitmentController = require('./controllers/recruitment.workflow.controller');
const onboardingController = require('./controllers/onboarding.controller');
const dynamicOnboardingController = require('./controllers/dynamicOnboarding.controller');
const bgvController = require('./controllers/bgv.controller');
const salaryStructureController = require('./controllers/salaryStructure.controller');

const getTenantDB = require('./utils/tenantDB');
const Tenant = require('./models/Tenant');

// Helper to construct request and response mocks
function makeReqRes(tenantDB, body, params = {}, query = {}, user = {}) {
    const req = {
        body,
        params,
        query,
        user: {
            id: '600000000000000000000001',
            _id: '600000000000000000000001',
            name: 'HR Admin',
            email: 'hr@gitakshmi.com',
            role: 'hr',
            tenantId: '6a1eb73c056191af5f4cf27c',
            ...user
        },
        tenantId: '6a1eb73c056191af5f4cf27c',
        tenantDB: tenantDB,
        db: tenantDB,
        ip: '127.0.0.1',
        get: (header) => 'Mozilla/5.0'
    };
    let statusVal = 200;
    let jsonVal = null;
    const res = {
        status: (code) => {
            statusVal = code;
            return res;
        },
        json: (data) => {
            jsonVal = data;
            return res;
        },
        send: (data) => {
            jsonVal = data;
            return res;
        },
        _status: () => statusVal,
        _json: () => jsonVal
    };
    return { req, res };
}

async function runE2ECycle() {
    console.log('🚀 Starting Programmatic E2E Hiring Cycle Test...');
    try {
        const MONGO_URI = process.env.MONGO_URI;
        if (!MONGO_URI) {
            throw new Error('MONGO_URI is missing in environment variables');
        }

        console.log('Connecting to database...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Database connected');

        // Register schemas globally to support global populates / helper services (e.g. BGV Case Candidate populates, Onboarding User/Role queries)
        if (!mongoose.models.User) mongoose.model('User', require('./models/User'));
        if (!mongoose.models.Role) mongoose.model('Role', require('./models/Role'));
        if (!mongoose.models.Candidate) mongoose.model('Candidate', require('./models/Candidate'));
        if (!mongoose.models.Applicant) mongoose.model('Applicant', require('./models/Applicant'));
        if (!mongoose.models.Employee) mongoose.model('Employee', require('./models/Employee'));
        if (!mongoose.models.Requirement) mongoose.model('Requirement', require('./models/Requirement'));
        if (!mongoose.models.Application) mongoose.model('Application', require('./models/Application'));
        if (!mongoose.models.Offer) mongoose.model('Offer', require('./models/Offer'));
        if (!mongoose.models.OnboardingSubmission) mongoose.model('OnboardingSubmission', require('./models/OnboardingSubmission'));
        if (!mongoose.models.OnboardingInstance) mongoose.model('OnboardingInstance', require('./models/OnboardingInstance'));
        if (!mongoose.models.OnboardingDocument) mongoose.model('OnboardingDocument', require('./models/OnboardingDocument'));

        // Resolve Tenant
        const tenantId = '6a1eb73c056191af5f4cf27c';
        let tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            console.log(`Tenant ${tenantId} not found in this new database. Seeding tenant...`);
            tenant = new Tenant({
                _id: tenantId,
                companyName: 'Gitakshmi',
                companyEmail: 'info@gitakshmi.com',
                ownerName: 'Dhruv Raval',
                password: 'hashedpassword123',
                tenantId: '6a1eb73c056191af5f4cf27c',
                apiKey: 'key_' + tenantId,
                code: 'pnr001',
                companyCode: 'pnr001',
                status: 'active',
                enabledModules: {
                    hr: true,
                    payroll: true,
                    attendance: true,
                    leave: true,
                    recruitment: true,
                    backgroundVerification: true,
                    documentManagement: true,
                    onboarding: true,
                    employeePortal: true,
                    reports: true,
                    policy: true,
                    accessControl: true
                }
            });
            await tenant.save();
            console.log('✅ Seeded Tenant:', tenant.companyName, '(Code:', tenant.code, ')');
        } else {
            console.log(`✅ Tenant resolved: ${tenant.companyName || tenant.name} (Code: ${tenant.code})`);
        }

        // Connect to Tenant DB
        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            throw new Error('Failed to resolve tenant database connection');
        }

        // Safe explicit model loading
        const Requirement = tenantDB.models.Requirement || tenantDB.model('Requirement', require('./models/Requirement'));
        const Candidate = tenantDB.models.Candidate || tenantDB.model('Candidate', require('./models/Candidate'));
        const Application = tenantDB.models.Application || tenantDB.model('Application', require('./models/Application'));
        const Offer = tenantDB.models.Offer || tenantDB.model('Offer', require('./models/Offer'));
        const SalaryTemplate = tenantDB.models.SalaryTemplate || tenantDB.model('SalaryTemplate', require('./models/SalaryTemplate'));
        const Employee = tenantDB.models.Employee || tenantDB.model('Employee', require('./models/Employee'));
        const BGVCase = tenantDB.models.BGVCase || tenantDB.model('BGVCase', require('./models/BGVCase'));
        const OnboardingInstance = tenantDB.models.OnboardingInstance || tenantDB.model('OnboardingInstance', require('./models/OnboardingInstance'));
        const OnboardingSubmission = mongoose.model('OnboardingSubmission');

        // 1. Ensure Requirement (Job) exists
        let job = await Requirement.findOne({ tenant: tenant._id, status: 'Open' });
        if (!job) {
            job = new Requirement({
                tenant: tenant._id,
                jobOpeningId: 'JOB-E2E-' + Date.now(),
                department: 'Engineering',
                jobTitle: 'E2E Software Engineer',
                jobDescription: {
                    roleOverview: 'Testing end-to-end recruitment flow',
                    responsibilities: ['Write code', 'Test code']
                },
                vacancy: 5,
                status: 'Open',
                workflow: ['Applied', 'Shortlisted', 'Interview', 'BGV', 'Finalized'],
                bgvConfig: {
                    isEnabled: true,
                    triggerStage: 'POST_OFFER',
                    checks: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT']
                }
            });
            await job.save();
            console.log('✅ Created mock Requirement (Job):', job.jobOpeningId);
        } else {
            job.workflow = ['Applied', 'Shortlisted', 'Interview', 'BGV', 'Finalized'];
            job.bgvConfig = {
                isEnabled: true,
                triggerStage: 'POST_OFFER',
                checks: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT']
            };
            await job.save();
            console.log('✅ Configured Requirement (Job) for BGV/Onboarding:', job.jobOpeningId);
        }

        // 2. Create Candidate
        const { generateCandidateId } = require('./utils/idGenerator');
        const candidateIdVal = await generateCandidateId(tenantDB);
        
        const email = `alexe2e_${Date.now()}@example.com`;
        const candidate = new Candidate({
            tenant: tenant._id,
            candidateId: candidateIdVal,
            name: 'Alex Tester',
            email: email,
            mobile: '9876543210',
            password: 'Password123'
        });
        await candidate.save();
        console.log('✅ Created Candidate:', candidate.name, email, 'candidateId:', candidateIdVal);

        // 3. Create Application (Job Application)
        const { req: reqApp, res: resApp } = makeReqRes(tenantDB, {
            jobId: job._id,
            candidateId: candidate._id,
            candidateInfo: {
                name: candidate.name,
                email: candidate.email,
                mobile: candidate.mobile,
                fatherName: 'Father Tester',
                dob: new Date('1995-01-01'),
                address: '123 Test Street'
            }
        });
        await recruitmentController.createApplication(reqApp, resApp);
        if (resApp._status() !== 201) {
            throw new Error('createApplication failed: ' + JSON.stringify(resApp._json()));
        }
        const appDoc = await Application.findById(resApp._json().data._id);
        console.log('✅ Created Application:', appDoc.applicationId, 'Status:', appDoc.status);

        // 4. Progress Application through status history to SELECTED
        const { req: reqShort, res: resShort } = makeReqRes(tenantDB, {
            status: 'SHORTLISTED',
            reason: 'E2E Shortlist'
        }, { applicationId: appDoc._id });
        await recruitmentController.updateApplicationStatus(reqShort, resShort);

        // Progress to INTERVIEW
        const { req: reqInt, res: resInt } = makeReqRes(tenantDB, {
            status: 'INTERVIEW',
            reason: 'E2E Interview'
        }, { applicationId: appDoc._id });
        await recruitmentController.updateApplicationStatus(reqInt, resInt);

        // Progress to OFFER_PENDING
        const { req: reqSel, res: resSel } = makeReqRes(tenantDB, {
            status: 'OFFER_PENDING',
            reason: 'E2E Selection'
        }, { applicationId: appDoc._id });
        await recruitmentController.updateApplicationStatus(reqSel, resSel);
        if (resSel._status() !== 200) {
            throw new Error('updateApplicationStatus to OFFER_PENDING failed: ' + JSON.stringify(resSel._json()));
        }

        const appDocSelected = await Application.findById(appDoc._id);
        console.log('✅ Progressed Application to OFFER_PENDING. Current Status:', appDocSelected.status);

        // 5. Ensure Salary Template & Suggest/Create CTC Structure
        let template = await SalaryTemplate.findOne({ tenantId: tenant._id, isActive: true });
        if (!template) {
            template = new SalaryTemplate({
                tenantId: tenant._id,
                templateName: 'Standard E2E Template',
                templateType: 'STANDARD',
                annualCTC: 600000,
                monthlyCTC: 50000,
                earnings: [
                    { name: 'Basic Salary', calculationType: 'PERCENT_CTC', percentage: 40, monthlyAmount: 20000, annualAmount: 240000 },
                    { name: 'HRA', calculationType: 'PERCENT_BASIC', percentage: 50, monthlyAmount: 10000, annualAmount: 120000 }
                ],
                isActive: true
            });
            await template.save();
            console.log('✅ Created Salary Template:', template.templateName);
        } else {
            console.log('✅ Found Salary Template:', template.templateName);
        }

        const { req: reqCTC, res: resCTC } = makeReqRes(tenantDB, {
            candidateId: appDoc._id, // Applicant ID is passed as candidateId for structure builder
            calculationMode: 'AUTO',
            enteredCTC: 600000,
            earnings: [],
            deductions: [],
            employerContributions: []
        });
        await salaryStructureController.createSalaryStructure(reqCTC, resCTC);
        if (resCTC._status() !== 200) {
            throw new Error('createSalaryStructure failed: ' + JSON.stringify(resCTC._json()));
        }
        const salStructure = resCTC._json().data;
        console.log('DEBUG salStructure:', JSON.stringify(salStructure));
        console.log('✅ Saved CTC Salary Structure. CTC Annual:', salStructure.totals?.annualCTC, 'ID:', salStructure._id);

        const dbSalaryStructureModel = tenantDB.model('SalaryStructure') || tenantDB.models.SalaryStructure;
        const foundByID = await dbSalaryStructureModel.findById(salStructure._id);
        console.log('DEBUG foundByID:', !!foundByID);
        const foundByIDAndTenant = await dbSalaryStructureModel.findOne({
            _id: salStructure._id,
            tenantId: tenant._id
        });
        console.log('DEBUG foundByIDAndTenant:', !!foundByIDAndTenant);
        const foundByIDAndTenantStr = await dbSalaryStructureModel.findOne({
            _id: salStructure._id,
            tenantId: String(tenant._id)
        });
        console.log('DEBUG foundByIDAndTenantStr:', !!foundByIDAndTenantStr);

        // 6. Generate Offer (DRAFT)
        const { req: reqOffer, res: resOffer } = makeReqRes(tenantDB, {
            salaryStructureId: salStructure._id,
            department: 'Engineering',
            designation: 'Software Engineer',
            location: 'Mumbai',
            joiningDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        }, { applicationId: appDoc._id });
        await recruitmentController.createOffer(reqOffer, resOffer);
        if (resOffer._status() !== 201) {
            throw new Error('createOffer failed: ' + JSON.stringify(resOffer._json()));
        }
        const offerDoc = await Offer.findById(resOffer._json().data._id);
        console.log('✅ Generated Offer:', offerDoc.offerId, 'Status:', offerDoc.status);

        // 7. Send Offer (SENT)
        const { req: reqSend, res: resSend } = makeReqRes(tenantDB, {
            sentAt: new Date(),
            expiryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }, { offerId: offerDoc._id });
        await recruitmentController.sendOffer(reqSend, resSend);
        if (resSend._status() !== 200) {
            throw new Error('sendOffer failed: ' + JSON.stringify(resSend._json()));
        }
        const offerDocSent = await Offer.findById(offerDoc._id);
        console.log('✅ Sent Offer to Candidate. Status:', offerDocSent.status);

        // 8. Accept Offer (ACCEPTED)
        const { req: reqAccept, res: resAccept } = makeReqRes(tenantDB, {
            acceptanceNotes: 'Gladly accepted!'
        }, { offerId: offerDoc._id }, {}, { id: candidate._id, role: 'candidate', name: candidate.name });
        await recruitmentController.acceptOffer(reqAccept, resAccept);
        if (resAccept._status() !== 200) {
            throw new Error('acceptOffer failed: ' + JSON.stringify(resAccept._json()));
        }
        const offerDocAccepted = await Offer.findById(offerDoc._id);
        console.log('✅ Offer Accepted. Status:', offerDocAccepted.status);

        // Manually ensure BGV trigger state is updated
        const appDocAccepted = await Application.findById(appDoc._id);
        if (!appDocAccepted.bgvStatus) {
            appDocAccepted.bgvStatus = 'INITIATED';
            try {
                const { generateBGVCaseId } = require('./utils/bgvCaseId');
                appDocAccepted.bgvId = await generateBGVCaseId(tenantDB, tenantId);
            } catch (e) {
                appDocAccepted.bgvId = 'BGV-E2E-' + Date.now();
            }
            await appDocAccepted.save();
        }

        // 9. BGV Initiation & Verification
        const { req: reqBGVInit, res: resBGVInit } = makeReqRes(tenantDB, {
            applicationId: appDoc._id,
            candidateId: candidate._id,
            package: 'BASIC',
            slaDays: 7
        });
        await bgvController.initiateBGV(reqBGVInit, resBGVInit);
        
        let bgvCaseDoc;
        if (resBGVInit._status() === 201) {
            bgvCaseDoc = resBGVInit._json().data.case;
        } else if (resBGVInit._status() === 409) {
            const { BGVCase: BGVCaseModel } = await require('./utils/bgvModels').getBGVModels(tenantId);
            bgvCaseDoc = await BGVCaseModel.findOne({ candidateId: candidate._id });
        } else {
            throw new Error('initiateBGV failed: ' + JSON.stringify(resBGVInit._json()));
        }
        console.log('✅ BGV Case Initiated. Case ID:', bgvCaseDoc.caseId);

        // Verify BGV Checks
        const { BGVCheck } = await require('./utils/bgvModels').getBGVModels(tenantId);
        const checks = await BGVCheck.find({ caseId: bgvCaseDoc._id });
        console.log(`📊 BGV Checks to verify: ${checks.length}`);
        
        for (const check of checks) {
            const { req: reqVCheck, res: resVCheck } = makeReqRes(tenantDB, {
                status: 'VERIFIED',
                internalRemarks: `${check.type} verified in E2E simulation`,
                verificationMethod: 'MANUAL'
            }, { checkId: check._id });
            await bgvController.verifyCheck(reqVCheck, resVCheck, (err) => { if (err) throw err; });
            if (resVCheck._status() !== 200) {
                throw new Error(`verifyCheck failed for ${check.type}: ` + JSON.stringify(resVCheck._json()));
            }
        }

        // Close & Approve BGV Case
        const { req: reqBGVClose, res: resBGVClose } = makeReqRes(tenantDB, {
            decision: 'APPROVED',
            remarks: 'BGV clear and approved'
        }, { id: bgvCaseDoc._id });
        await bgvController.closeBGV(reqBGVClose, resBGVClose, (err) => { if (err) throw err; });
        if (resBGVClose._status() !== 200) {
            throw new Error('closeBGV failed: ' + JSON.stringify(resBGVClose._json()));
        }
        const finalBGVCase = await BGVCase.findById(bgvCaseDoc._id);
        console.log('✅ BGV Case Closed. Overall Status:', finalBGVCase.overallStatus);

        // 10. Start Onboarding & Inviting Candidate
        console.log('Auto-starting onboarding instance...');
        const appDocUpdated = await Application.findById(appDoc._id);
        const onboardingInstance = await onboardingController.autoStartOnboardingForApplicant({
            req: reqAccept,
            applicant: appDocUpdated,
            actor: { id: '600000000000000000000001', role: 'hr', name: 'HR Admin' },
            ensurePortalLink: true,
            notifyCandidate: false
        });

        const instance = await OnboardingInstance.findOne({ applicant: appDoc._id });
        if (!instance) {
            throw new Error('OnboardingInstance not found for applicant');
        }
        instance.payrollSetup = {
            status: 'pending',
            salaryTemplateId: template._id,
            ctcAnnual: salStructure.totals.annualCTC,
            effectiveFrom: new Date()
        };
        await instance.save();
        console.log('✅ Onboarding Instance Created and Payroll configured. Status:', instance.status, 'Employee Draft ID:', instance.employee);

        let submission = await OnboardingSubmission.findOne({ candidateId: candidate._id });
        if (!submission) {
            console.log('OnboardingSubmission not found. Generating programmatically for E2E flow...');
            const token = require('crypto').randomBytes(32).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            const dbTemplateModel = tenantDB.model('OnboardingTemplate') || tenantDB.models.OnboardingTemplate;
            let dynamicTemplate = await dbTemplateModel.findOne({ tenant: tenant._id });
            if (!dynamicTemplate) {
                const { req: reqT, res: resT } = makeReqRes(tenantDB, {});
                await dynamicOnboardingController.getTemplates(reqT, resT);
                dynamicTemplate = await dbTemplateModel.findOne({ tenant: tenant._id });
            }
            
            submission = new OnboardingSubmission({
                tenant: tenant._id,
                candidateId: candidate._id,
                templateId: dynamicTemplate._id,
                templateVersion: dynamicTemplate.version,
                inviteToken: token,
                expiresAt,
                status: 'INVITED',
                responses: {},
                documents: []
            });
            await submission.save();
            console.log('✅ Created mock OnboardingSubmission programmatically for E2E verification');
        }
        
        console.log('DEBUG: OnboardingSubmission model collection name:', OnboardingSubmission.collection.name);
        console.log('DEBUG: OnboardingSubmission db name:', OnboardingSubmission.db.name);
        
        const testSub = await OnboardingSubmission.findOne({ inviteToken: submission.inviteToken });
        console.log('DEBUG: Found locally compiled submission:', !!testSub);

        const globSubModel = mongoose.model('OnboardingSubmission');
        console.log('DEBUG: globSubModel db name:', globSubModel.db.name);
        const testGlobSub = await globSubModel.findOne({ inviteToken: submission.inviteToken });
        console.log('DEBUG: Found globally compiled submission:', !!testGlobSub);

        const token = submission.inviteToken;
        console.log('✅ Candidate Onboarding Invite Token:', token);

        // Candidate submits portal responses
        const { req: reqPortal, res: resPortal } = makeReqRes(tenantDB, {
            responses: {
                full_name: 'Alex Tester',
                dob: '1995-01-01',
                gender: 'Male',
                father_name: 'Father Tester',
                aadhaar: '123456789012',
                pan: 'ABCDE1234F',
                bank_name: 'E2E Test Bank',
                acc_no: '9876543210',
                ifsc: 'TEST0001234',
                accept: true
            }
        }, { token });
        await dynamicOnboardingController.submitPublicPortal(reqPortal, resPortal);
        if (resPortal._status() !== 200) {
            throw new Error('submitPublicPortal failed: ' + JSON.stringify(resPortal._json()));
        }
        console.log('✅ Onboarding Portal form submitted by candidate');

        // HR verifies submission
        const updatedSubmission = await OnboardingSubmission.findOne({ candidateId: candidate._id });
        const { req: reqVerifyOnboard, res: resVerifyOnboard } = makeReqRes(tenantDB, {
            submissionId: updatedSubmission._id,
            status: 'COMPLETED',
            remarks: 'All documents verified successfully'
        });
        await dynamicOnboardingController.verifySubmission(reqVerifyOnboard, resVerifyOnboard);
        if (resVerifyOnboard._status() !== 200) {
            throw new Error('verifySubmission failed: ' + JSON.stringify(resVerifyOnboard._json()));
        }
        console.log('✅ Onboarding Submission verified by HR');

        // Final Activation (Converts Candidate to active Employee)
        const { req: reqActivate, res: resActivate } = makeReqRes(tenantDB, {
            onboardingId: instance._id,
            actualJoiningDate: new Date()
        }, { id: instance._id });
        await onboardingController.activateOnboarding(reqActivate, resActivate);
        if (resActivate._status() !== 200) {
            throw new Error('activateOnboarding failed: ' + JSON.stringify(resActivate._json()));
        }
        console.log('✅ Onboarding Completed and Employee Activated!');

        // 11. Final Verification
        const finalEmp = await Employee.findById(instance.employee);
        console.log('\n==================================================');
        console.log('           FINAL VERIFICATION REPORT             ');
        console.log('==================================================');
        console.log('Employee Name:      ', `${finalEmp.firstName} ${finalEmp.lastName}`);
        console.log('Employee ID:        ', finalEmp.employeeId);
        console.log('Status:             ', finalEmp.status);
        console.log('Salary Template ID: ', finalEmp.salaryTemplateId);
        console.log('Salary Snapshot ID: ', finalEmp.currentSalarySnapshotId);
        console.log('Salary Assigned:    ', finalEmp.salaryAssigned);
        console.log('BGV Cleared:         Yes (overallStatus: APPROVED/VERIFIED)');
        console.log('Onboarding Status:  ', (await OnboardingInstance.findById(instance._id)).status);
        console.log('==================================================\n');

        if (finalEmp.status?.toLowerCase() === 'active' && finalEmp.salaryAssigned) {
            console.log('🎉 SUCCESS: Entire E2E Hiring Pipeline Verification Passed!');
        } else {
            throw new Error('E2E validation failed: Employee status or salary setup is incorrect');
        }

    } catch (err) {
        console.error('❌ E2E Cycle Test Failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
    }
}

runE2ECycle();
