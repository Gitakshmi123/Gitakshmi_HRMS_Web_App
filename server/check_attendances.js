const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function run() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('MONGO_URI is missing in .env');
        
        await mongoose.connect(uri);
        console.log('Connected to admin/main database.');
        
        const Tenant = mongoose.model('Tenant', require('./models/Tenant'));
        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants.`);
        
        for (const tenant of tenants) {
            console.log(`\nTenant: ${tenant.companyName} (${tenant._id}) - DB: ${tenant.dbName}`);
            
            const tenantDB = mongoose.connection.useDb(tenant.dbName);
            
            const Employee = tenantDB.model('Employee', require('./models/Employee'));
            const Attendance = tenantDB.model('Attendance', require('./models/Attendance'));
            const LeaveRequest = tenantDB.model('LeaveRequest', require('./models/LeaveRequest'));
            
            const employees = await Employee.find({}).lean();
            console.log(`- Employees count: ${employees.length}`);
            employees.forEach(emp => {
                console.log(`  * ${emp.firstName} ${emp.lastName} (${emp._id}) - ID: ${emp.employeeId}`);
            });
            
            const attendances = await Attendance.find({}).lean();
            console.log(`- Attendance records count: ${attendances.length}`);
            attendances.forEach(att => {
                console.log(`  * Date: ${att.date.toISOString().split('T')[0]}, Employee: ${att.employee}, Status: ${att.status}, checkIn: ${att.checkIn}, checkOut: ${att.checkOut}`);
            });
            
            const leaves = await LeaveRequest.find({}).lean();
            console.log(`- Leave requests count: ${leaves.length}`);
            leaves.forEach(l => {
                console.log(`  * Type: ${l.leaveType}, Employee: ${l.employee}, Status: ${l.status}, Start: ${l.startDate.toISOString().split('T')[0]}, End: ${l.endDate.toISOString().split('T')[0]}`);
            });
        }
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
