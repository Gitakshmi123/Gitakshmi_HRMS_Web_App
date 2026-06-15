const mongoose = require('mongoose');
require('dotenv').config();

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const dbName = `company_${tenantId}`;
        const db = mongoose.connection.useDb(dbName);

        const Employee = db.model('Employee', new mongoose.Schema({ firstName: String, lastName: String, employeeId: String }));
        const Applicant = db.model('Applicant', new mongoose.Schema({ name: String, employeeId: mongoose.Schema.Types.ObjectId, salarySnapshot: Object }));
        const EmployeeCompensation = db.model('EmployeeCompensation', new mongoose.Schema({ employeeId: mongoose.Schema.Types.ObjectId, isActive: Boolean, status: String, components: Array }));
        const SalaryStructure = mongoose.model('SalaryStructure', new mongoose.Schema({ candidateId: mongoose.Schema.Types.ObjectId, totals: Object, earnings: Array, deductions: Array, employerBenefits: Array }));

        const employeeIdFromLogs = '698b2b86eaaf4b1b306890d5';

        console.log('Searching for Person ID:', employeeIdFromLogs);

        const emp = await Employee.findById(employeeIdFromLogs);
        if (emp) {
            console.log('Found Employee:', emp.firstName, emp.lastName, 'Code:', emp.employeeId);

            const comp = await EmployeeCompensation.findOne({ employeeId: emp._id });
            console.log('EmployeeCompensation:', comp ? 'FOUND' : 'NOT FOUND');

            const app = await Applicant.findOne({ employeeId: emp._id });
            console.log('Linked Applicant:', app ? 'FOUND (App ID: ' + app._id + ')' : 'NOT FOUND');
            if (app) {
                console.log('App Snapshot:', JSON.stringify(app.salarySnapshot, null, 2));
                const structure = await SalaryStructure.findOne({ candidateId: app._id });
                console.log('SalaryStructure by App ID:', structure ? 'FOUND' : 'NOT FOUND');
                if (structure) {
                    console.log('Structure Totals:', JSON.stringify(structure.totals, null, 2));
                }
            }
        } else {
            console.log('Employee not found by ID. Searching Applicants...');
            const app = await Applicant.findById(employeeIdFromLogs);
            if (app) {
                console.log('Found Applicant:', app.name);
                console.log('App Snapshot:', JSON.stringify(app.salarySnapshot, null, 2));
                const structure = await SalaryStructure.findOne({ candidateId: app._id });
                console.log('SalaryStructure by App ID:', structure ? 'FOUND' : 'NOT FOUND');
                if (structure) {
                    console.log('Structure Totals:', JSON.stringify(structure.totals, null, 2));
                }
            } else {
                console.log('No Employee or Applicant found with that ID');
            }
        }

        // List all compensation records just in case
        const allComp = await EmployeeCompensation.find({});
        console.log('\nTotal EmployeeCompensation records in this tenant:', allComp.length);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
