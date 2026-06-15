const mongoose = require('mongoose');
require('dotenv').config();

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const SalaryStructure = mongoose.model('SalaryStructure', new mongoose.Schema({ candidateId: mongoose.Schema.Types.ObjectId, tenantId: mongoose.Schema.Types.ObjectId, totals: Object }));

        const count = await SalaryStructure.countDocuments({});
        console.log('Total SalaryStructure records:', count);

        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const tenantStructures = await SalaryStructure.find({ tenantId });
        console.log('SalaryStructure records for this tenant:', tenantStructures.length);

        for (const s of tenantStructures) {
            console.log(' - CandidateId:', s.candidateId, 'Totals:', JSON.stringify(s.totals));
        }

        const dbName = `company_${tenantId}`;
        const db = mongoose.connection.useDb(dbName);
        const Applicant = db.model('Applicant', new mongoose.Schema({ name: String, email: String, employeeId: mongoose.Schema.Types.ObjectId }));
        const Employee = db.model('Employee', new mongoose.Schema({ firstName: String, lastName: String, email: String }));

        const dhirenEmp = await Employee.findById('698b2b86eaaf4b1b306890d5');
        if (dhirenEmp) {
            console.log('Dhiren Email:', dhirenEmp.email);
            const dhirenApp = await Applicant.findOne({ email: dhirenEmp.email });
            console.log('Applicant found by email:', dhirenApp ? dhirenApp._id : 'NOT FOUND');
            if (dhirenApp) {
                const s = await SalaryStructure.findOne({ candidateId: dhirenApp._id });
                console.log('SalaryStructure for this Applicant:', s ? 'FOUND' : 'NOT FOUND');
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
