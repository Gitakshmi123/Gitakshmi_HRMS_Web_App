require('dotenv').config();
const mongoose = require('mongoose');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to DB');

        const tenantDB = mongoose.connection;
        
        const Employee = tenantDB.model('Employee', require('./models/Employee').schema || require('./models/Employee'));
        const Attendance = tenantDB.model('Attendance', require('./models/Attendance').schema || require('./models/Attendance'));
        const Regularization = tenantDB.model('Regularization', require('./models/Regularization').schema || require('./models/Regularization'));
        const Holiday = tenantDB.model('Holiday', require('./models/Holiday').schema || require('./models/Holiday'));

        const employees = await Employee.find({ status: { $regex: /^active$/i } });
        console.log(`Found ${employees.length} active employees`);

        if (employees.length === 0) {
            console.log('No active employees found to seed against.');
            process.exit(0);
        }

        const tenantId = employees[0].tenant || employees[0].mainCompanyId;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let attCount = 0;
        
        // 1. Seed Attendance for the current month
        for (const emp of employees) {
            for (let day = 1; day <= daysInMonth; day++) {
                // Ensure date is exact midnight local time or noon to avoid UTC shifts
                const date = new Date(year, month, day, 12, 0, 0); 
                
                // Skip weekends (Sunday=0, Saturday=6)
                if (date.getDay() === 0) {
                    await Attendance.findOneAndUpdate(
                        { employee: emp._id, date: date },
                        { tenant: tenantId, employee: emp._id, date: date, status: 'weekly_off' },
                        { upsert: true }
                    );
                    continue;
                }
                
                // Make some random statuses
                let status = 'present';
                if (day % 15 === 0) status = 'leave';
                else if (day % 11 === 0) status = 'absent';
                
                const checkIn = new Date(year, month, day, 9, Math.floor(Math.random() * 30), 0);
                const checkOut = new Date(year, month, day, 18, Math.floor(Math.random() * 30), 0);
                
                const logs = (status === 'present') ? [
                    { type: 'IN', timestamp: checkIn },
                    { type: 'OUT', timestamp: checkOut }
                ] : [];

                await Attendance.findOneAndUpdate(
                    { employee: emp._id, date: date },
                    { 
                        tenant: tenantId,
                        employee: emp._id,
                        date: date,
                        status: status,
                        logs: logs,
                        leaveType: status === 'leave' ? 'CL' : undefined
                    },
                    { upsert: true }
                );
                attCount++;
            }
        }
        console.log(`Seeded ${attCount} Attendance records for ${month + 1}/${year}`);

        // 2. Seed Regularization Requests
        await Regularization.deleteMany({});
        for (let i = 0; i < Math.min(employees.length, 3); i++) {
            const emp = employees[i];
            const startDate = new Date(year, month, i + 5, 9, 0, 0);
            const endDate = new Date(year, month, i + 5, 18, 0, 0);
            
            await Regularization.create({
                tenant: tenantId,
                employee: emp._id,
                category: 'Attendance',
                startDate: startDate,
                endDate: endDate,
                issueType: 'Missed Punch',
                reason: 'Forgot to punch out due to client meeting',
                status: i === 0 ? 'Pending' : (i === 1 ? 'Approved' : 'Rejected'),
                originalData: { inTime: null, outTime: null },
                requestedData: { inTime: '09:00', outTime: '18:30' }
            });
        }
        console.log('Seeded Regularization requests');

        // 3. Seed Holidays
        await Holiday.deleteMany({});
        await Holiday.create([
            {
                tenant: tenantId,
                name: 'Republic Day',
                date: new Date(year, 0, 26, 12, 0, 0),
                type: 'National'
            },
            {
                tenant: tenantId,
                name: 'Independence Day',
                date: new Date(year, 7, 15, 12, 0, 0),
                type: 'National'
            },
            {
                tenant: tenantId,
                name: 'Diwali',
                date: new Date(year, 10, 1, 12, 0, 0),
                type: 'Festival'
            }
        ]);
        console.log('Seeded Holidays');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
seed();
