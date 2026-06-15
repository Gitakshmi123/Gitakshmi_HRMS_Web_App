const mongoose = require('mongoose');

async function findEmployeeEverywhere() {
    const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
    try {
        await mongoose.connect(MONGO_URI);
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        const companyDbs = dbs.databases.filter(d => d.name.startsWith('company_')).map(d => d.name);
        
        const targetId = '69f8bda0359f282f4a742ac7';
        
        for (const dbName of companyDbs) {
            const db = mongoose.connection.useDb(dbName);
            const Employee = db.model('Employee', new mongoose.Schema({}, { strict: false }));
            const emp = await Employee.findById(targetId).lean();
            if (emp) {
                console.log(`FOUND in ${dbName}`);
                console.log('Employee Name:', emp.firstName, emp.lastName);
                console.log('Band:', emp.band);
                console.log('Policy ID:', emp.leavePolicy);
                
                const LeaveBalance = db.model('LeaveBalance', new mongoose.Schema({}, { strict: false }));
                const balances = await LeaveBalance.find({ employee: targetId, year: 2026 }).lean();
                console.log('Balances:', balances.map(b => `${b.leaveType}: ${b.total}`).join(', '));
                
                const LeavePolicy = db.model('LeavePolicy', new mongoose.Schema({}, { strict: false }));
                if (emp.leavePolicy) {
                   const policy = await LeavePolicy.findById(emp.leavePolicy).lean();
                   console.log('Policy Name:', policy.name);
                   console.log('Policy Rules:', JSON.stringify(policy.rules, null, 2));
                }
                
                process.exit();
            }
        }
        
        console.log('Employee not found in any company DB');
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

findEmployeeEverywhere();
