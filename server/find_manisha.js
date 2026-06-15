const mongoose = require('mongoose');

async function findEmployeeEverywhere() {
    try {
        const client = await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to DB');

        const db = mongoose.connection.db;
        const adminDb = mongoose.connection.useDb('admin').db;
        const dbs = await adminDb.admin().listDatabases();
        
        console.log('Databases:', dbs.databases.map(d => d.name));

        const companyDbs = dbs.databases.filter(d => d.name.startsWith('company_'));
        
        for (const dbInfo of companyDbs) {
            console.log(`Searching in ${dbInfo.name}...`);
            const tenantDb = mongoose.connection.useDb(dbInfo.name);
            const Employee = tenantDb.collection('employees');
            const Attendance = tenantDb.collection('attendances');
            
            const manisha = await Employee.findOne({ $or: [{ firstName: /Manisha/i, lastName: /Jethwani/i }, { employeeId: 'EMP-2026-1000' }] });
            
            if (manisha) {
                console.log(`✅ Found Manisha in ${dbInfo.name}!`);
                console.log(`ID: ${manisha._id}, Name: ${manisha.firstName} ${manisha.lastName}, EmpID: ${manisha.employeeId}`);
                
                const records = await Attendance.find({ 
                    employee: manisha._id,
                    date: {
                        $gte: new Date('2026-01-01T00:00:00.000Z'),
                        $lt: new Date('2026-02-01T00:00:00.000Z')
                    }
                }).sort({ date: 1 }).toArray();
                
                console.log(`Found ${records.length} records for her in Jan 2026:`);
                records.forEach(r => {
                    console.log(`Date: ${r.date ? r.date.toISOString() : 'MISSING'}, Status: ${r.status}, WorkingHours: ${r.workingHours}`);
                });
                return;
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

findEmployeeEverywhere();
