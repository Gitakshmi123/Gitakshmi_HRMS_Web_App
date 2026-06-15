const mongoose = require('mongoose');

async function repairAttendance() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to Tenant DB');

        const db = mongoose.connection.db;
        const attendanceCol = db.collection('attendances');

        const records = await attendanceCol.find({}).toArray();
        console.log(`Found ${records.length} records to check.`);

        let updatedCount = 0;
        for (const record of records) {
            const originalDate = record.date;
            if (!originalDate) continue;

            // Normalize to UTC Midnight using local date parts (respecting IST offset in the stored timestamp)
            const correctedDate = new Date(Date.UTC(
                originalDate.getFullYear(),
                originalDate.getMonth(),
                originalDate.getDate(),
                0, 0, 0, 0
            ));

            if (originalDate.toISOString() !== correctedDate.toISOString()) {
                await attendanceCol.updateOne(
                    { _id: record._id },
                    { $set: { date: correctedDate } }
                );
                updatedCount++;
            }
        }

        console.log(`✅ Repair complete. Updated ${updatedCount} records to UTC midnight.`);

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

repairAttendance();
