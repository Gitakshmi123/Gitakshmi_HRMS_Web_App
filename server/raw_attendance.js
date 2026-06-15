const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findOne({ code: 'abc002' });

        const dbName = `company_${tenant._id}`;
        const db = mongoose.connection.useDb(dbName);
        const Attendance = db.model('Attendance', require('./models/Attendance'));

        const all = await Attendance.find({
            date: { $gte: new Date(2026, 0, 1), $lte: new Date(2026, 1, 1) }
        }).limit(10);

        console.log(`Total records in Jan 2026: ${all.length}`);
        all.forEach(a => {
            console.log(`- Emp: ${a.employee}, Status: ${a.status}, Date: ${a.date}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
