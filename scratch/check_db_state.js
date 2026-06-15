const mongoose = require('mongoose');

async function checkEmployee() {
    const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
    try {
        await mongoose.connect(MONGO_URI);
        const employeeId = '69f8bda0359f282f4a742ac7'; // From screenshot URL
        
        const Employee = mongoose.connection.model('Employee', new mongoose.Schema({}, { strict: false }));
        const LeaveBalance = mongoose.connection.model('LeaveBalance', new mongoose.Schema({}, { strict: false }));
        const LeavePolicy = mongoose.connection.model('LeavePolicy', new mongoose.Schema({}, { strict: false }));

        const emp = await Employee.findById(employeeId).lean();
        console.log('--- Employee Data ---');
        console.log('Name:', emp.firstName, emp.lastName);
        console.log('Band:', emp.band);
        console.log('Policy ID:', emp.leavePolicy);
        console.log('Leave Balance Snapshot:', emp.leaveBalance);
        console.log('Joining Date:', emp.joiningDate);

        const balances = await LeaveBalance.find({ employee: employeeId, year: 2026 }).lean();
        console.log('\n--- Leave Balances ---');
        balances.forEach(b => {
            console.log(`${b.leaveType}: total=${b.total}, available=${b.available}, used=${b.used}, locked=${b.locked}`);
        });

        if (emp.leavePolicy) {
            const policy = await LeavePolicy.findById(emp.leavePolicy).lean();
            console.log('\n--- Policy Data ---');
            console.log('Name:', policy.name);
            console.log('ApplicableTo:', policy.applicableTo);
            console.log('ApplicableBands:', policy.applicableBands);
            console.log('Rules:', JSON.stringify(policy.rules, null, 2));
        }

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkEmployee();
