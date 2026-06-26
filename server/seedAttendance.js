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
        
        // Ensure schemas are loaded
        const employeeSchema = require('./models/Employee').schema || require('./models/Employee');
        const attendanceSchema = require('./models/Attendance').schema || require('./models/Attendance');
        
        const Employee = tenantDB.model('Employee', employeeSchema);
        const Attendance = tenantDB.model('Attendance', attendanceSchema);

        const employees = await Employee.find({ status: { $regex: /^active$/i } });
        console.log(`Found ${employees.length} active employees`);

        const year = 2026;
        const months = [5, 6]; // May and June
        let count = 0;

        for (const emp of employees) {
            for (const month of months) {
                const daysInMonth = new Date(year, month, 0).getDate();
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
                    
                    // Skip weekends (Sunday=0, Saturday=6)
                    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;

                    const exists = await Attendance.findOne({ employee: emp._id, date });
                    if (!exists) {
                        const checkIn = new Date(Date.UTC(year, month - 1, day, 4, 0, 0)); // 9:30 AM IST
                        const checkOut = new Date(Date.UTC(year, month - 1, day, 13, 0, 0)); // 6:30 PM IST
                        await Attendance.create({
                            tenant: emp.tenant || emp.mainCompanyId,
                            employee: emp._id,
                            date: date,
                            status: 'present',
                            checkIn: checkIn,
                            checkOut: checkOut,
                            checkInTime: checkIn,
                            checkOutTime: checkOut,
                            workingHours: 9
                        });
                        count++;
                    }
                }
            }
        }
        
        console.log(`Inserted ${count} attendance records for May and June 2026`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
seed();
