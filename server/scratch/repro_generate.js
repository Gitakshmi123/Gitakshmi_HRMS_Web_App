const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const getTenantDB = require('../utils/tenantDB');
const { getModels } = require('../utils/tenantUtils');
const letterCtrl = require('../controllers/letter.controller');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const Tenant = mongoose.connection.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
    const tenant = await Tenant.findOne({ code: 'dem001' });
    const tenantId = tenant._id.toString();

    const tenantDB = await getTenantDB(tenantId);
    const { Applicant, LetterTemplate } = getModels(tenantDB);
    
    // Find Jayesh
    const applicant = await Applicant.findOne({ name: /jayesh/i });
    if (!applicant) {
      console.error("Applicant Jayesh not found");
      process.exit(1);
    }

    // Use a hardcoded mock user
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'HR Admin',
      email: 'hr@example.com'
    };

    // Find Template of type offer
    const template = await LetterTemplate.findOne({ type: 'offer' });
    if (!template) {
      console.error("Offer template not found");
      process.exit(1);
    }

    console.log(`Using Applicant ID: ${applicant._id}`);
    console.log(`Using Template ID: ${template._id}`);

    // Mock Req
    const req = {
      tenantDB,
      tenantId,
      user: {
        id: mockUser._id.toString(),
        userId: mockUser._id.toString(),
        tenantId,
        name: mockUser.name,
        email: mockUser.email,
        roleName: 'admin'
      },
      body: {
        applicantId: applicant._id.toString(),
        templateId: template._id.toString(),
        joiningDate: '2026-07-01',
        expiryAt: new Date(Date.now() + 5*24*60*60*1000).toISOString(),
        location: 'Ahmedabad',
        address: 'Test Address',
        refNo: 'GTPL/GEN/OFF/26-27/0002',
        salutation: 'Mr.',
        relationType: 'S/O',
        issueDate: '2026-06-24',
        name: 'jayesh',
        dearName: 'jayesh',
        dateFormat: 'Do MMM. YYYY',
        signaturePosition: { alignment: 'right' },
        jobCategory: 'Full Time',
        probationPeriod: '3 months',
        customWorkflow: true,
        emailTemplateId: '6a3b1888c900a29aa8bd039e',
        customApprovers: [
          { roleName: 'Manager', email: 'manager@example.com', name: 'Manager' }
        ],
        customData: {
          candidate_surname: 'raval'
        }
      }
    };

    // Mock Res
    const res = {
      status(code) {
        console.log(`Response Status: ${code}`);
        if (code === 400) {
          const err = new Error('res.status(400) was called');
          console.error(err.stack);
        }
        return this;
      },
      json(data) {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
        return this;
      }
    };

    await letterCtrl.generateOfferLetter(req, res);

  } catch (error) {
    console.error("Fatal Error running test:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
