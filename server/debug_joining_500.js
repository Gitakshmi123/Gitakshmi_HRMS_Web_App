
const mongoose = require('mongoose');
const letterController = require('./controllers/letter.controller');
const Applicant = require('./models/Applicant');
const LetterTemplate = require('./models/LetterTemplate');
const path = require('path');
const dotenv = require('dotenv');

// Load env from current file's directory (server/.env)
dotenv.config({ path: path.join(__dirname, '.env') });

const MOCK_REQ = {
    body: {},
    user: {
        tenantId: null,
        userId: 'debug-admin'
    },
    tenantDB: mongoose
};

const MOCK_RES = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log("RESPONSE_STATUS: " + this.statusCode);
        console.log("RESPONSE_DATA: " + JSON.stringify(data));
        return this;
    }
};

async function run() {
    console.log('STARTING DEBUG SCRIPT (VERIFICATION)');

    try {
        if (!process.env.MONGO_URI) {
            console.log('NO MONGO_URI FOUND');
            process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/hrms-saas';
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('CONNECTED TO MONGO');
    } catch (e) {
        console.log('MONGO CONNECT ERROR: ' + e.message);
        return;
    }

    try {
        const applicant = await Applicant.findOne({ status: { $in: ['Selected', 'Joined', 'Offered'] } });
        if (!applicant) { console.log('NO APPLICANT FOUND'); return; }
        console.log('FOUND APPLICANT: ' + applicant._id);

        MOCK_REQ.user.tenantId = applicant.tenantId;

        const template = await LetterTemplate.findOne({ type: 'joining' });
        if (!template) { console.log('NO TEMPLATE FOUND'); return; }
        console.log('FOUND TEMPLATE: ' + template._id);

        MOCK_REQ.body.templateId = template._id.toString();
        MOCK_REQ.body.applicantId = applicant._id.toString();

        // PAYLOAD WITH MISSING ADDRESS (Trigger the bug)
        MOCK_REQ.body.customData = {
            EMPLOYEE_NAME: 'Debug User',
            ADDRESS: '',
            BASIC_SALARY: '600000',
            HRA: '300000'
        };

        console.log('CALLING CONTROLLER...');
        await letterController.generateJoiningLetter(MOCK_REQ, MOCK_RES);
        console.log('CONTROLLER FINISHED');
    } catch (err) {
        console.log('CAUGHT ERROR IN EXECUTION');
        console.log(err.stack);
    } finally {
        await mongoose.disconnect();
    }
}

run();
