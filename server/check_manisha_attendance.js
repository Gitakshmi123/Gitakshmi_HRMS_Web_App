const mongoose = require('mongoose');

// Define schemas locally to avoid registration issues
const AttendanceSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    date: Date,
    status: String,
    workingHours: Number,
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { strict: false });

const EmployeeSchema = new mongoose.Schema({
    employeeId: String,
    firstName: String,
    lastName: String,
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { strict: false });

async function checkAttendance() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to DB');

        const Employee = mongoose.model('Employee', EmployeeSchema);
        const Attendance = mongoose.model('Attendance', AttendanceSchema);
        
        const manisha = await Employee.findOne({ employeeId: 'EMP-2026-1000' });
        
        if(!manisha) {
            console.log('Manisha not found');
            const allEmployees = await Employee.find({}).limit(5);
            console.log('Sample employees:', allEmployees.map(e => e.employeeId));
            process.exit(0);
        }
        
        console.log(`Found Manisha: ${manisha.firstName} ${manisha.lastName} (${manisha._id})`);
        
        const records = await Attendance.find({ 
            employee: manisha._id,
            date: {
                $gte: new Date('2026-01-01T00:00:00.000Z'),
                $lt: new Date('2026-02-01T00:00:00.000Z')
            }
        }).sort({ date: 1 });
        
        console.log(`Found ${records.length} records for her in Jan 2026:`);
        records.forEach(r => {
            console.log(`Date: ${r.date.toISOString()}, Status: ${r.status}, WorkingHours: ${r.workingHours}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkAttendance();
