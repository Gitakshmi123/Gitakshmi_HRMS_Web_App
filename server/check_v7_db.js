const mongoose = require('mongoose');

async function checkSpecificDb() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_695d4a6c409f9301a0df9a1d?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to company_695d4a6c409f9301a0df9a1d');

        const db = mongoose.connection.db;
        const employees = await db.collection('employees').find({}).toArray();
        console.log(`Employees: ${employees.length}`);
        
        const attendance = await db.collection('attendances').find({}).toArray();
        console.log(`Attendance records: ${attendance.length}`);
        
        if (attendance.length > 0) {
            console.log('Sample Attendance:');
            attendance.slice(0, 5).forEach(a => {
                console.log(`Emp: ${a.employee}, Date: ${a.date}, Status: ${a.status}`);
            });
        }

    } catch (err) {
        console.error('Error connecting or querying:', err.message);
    } finally {
        mongoose.disconnect();
    }
}

checkSpecificDb();
