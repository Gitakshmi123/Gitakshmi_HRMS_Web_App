const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

// [DNS-FIX]: Force Google DNS and IPv4 for Atlas SRV resolution issues
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (e) {
    console.warn('⚠️ DNS override failed:', e.message);
}

// Configure environment / database
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms'; // fallback

async function run() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const EmployeeSchema = new mongoose.Schema({}, { strict: false });
        const LeavePolicySchema = new mongoose.Schema({}, { strict: false });
        const LeaveBalanceSchema = new mongoose.Schema({}, { strict: false });

        const Employee = mongoose.model('Employee', EmployeeSchema);
        const LeavePolicy = mongoose.model('LeavePolicy', LeavePolicySchema);
        const LeaveBalance = mongoose.model('LeaveBalance', LeaveBalanceSchema);

        const employee = await Employee.findOne({ employeeId: 'EMP-26-27-1000' }).lean();
        if (!employee) {
            console.log('Employee EMP-26-27-1000 not found in main connection! Let us search all databases.');
            const admin = new mongoose.mongo.Admin(mongoose.connection.db);
            const dbs = await admin.listDatabases();
            console.log('Available databases:', dbs.databases.map(d => d.name));
            
            for (const dbInfo of dbs.databases) {
                if (dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') continue;
                console.log(`Checking database: ${dbInfo.name}...`);
                const conn = mongoose.createConnection(`${mongoUri.split('?')[0].replace(/\/([^\/]*)$/, '')}/${dbInfo.name}`);
                await conn.asPromise();
                
                const EmpModel = conn.model('Employee', EmployeeSchema);
                const PolicyModel = conn.model('LeavePolicy', LeavePolicySchema);
                const BalModel = conn.model('LeaveBalance', LeaveBalanceSchema);

                const emp = await EmpModel.findOne({ employeeId: 'EMP-26-27-1000' }).lean();
                if (emp) {
                    console.log(`Found Employee in DB: ${dbInfo.name}!`);
                    console.log('Name:', emp.firstName, emp.lastName);
                    console.log('Leave Policy Ref:', emp.leavePolicy);
                    
                    if (emp.leavePolicy) {
                        const policy = await PolicyModel.findById(emp.leavePolicy).lean();
                        console.log('Assigned Leave Policy:', policy?.name);
                        console.log('Rules Count:', policy?.rules?.length);
                        console.log('Rules:', JSON.stringify(policy?.rules, null, 2));
                    }
                    
                    const balances = await BalModel.find({ employee: emp._id }).lean();
                    console.log('Balances:', JSON.stringify(balances, null, 2));
                    
                    const allPolicies = await PolicyModel.find({}).lean();
                    console.log('All Policies in Tenant:');
                    allPolicies.forEach(p => console.log(`- ${p.name} (ID: ${p._id}, Status: ${p.status}, Active: ${p.isActive}, Rules: ${p.rules?.length || 0})`));
                    
                    conn.close();
                    break;
                }
                conn.close();
            }
            return;
        }

        console.log('--- EMPLOYEE PROFILE ---');
        console.log('Name:', employee.firstName, employee.lastName);
        console.log('Leave Policy Ref:', employee.leavePolicy);

    } catch (err) {
        console.error('Error running diagnostic:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database.');
    }
}

run();
