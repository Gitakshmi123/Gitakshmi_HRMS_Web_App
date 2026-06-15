const mongoose = require('mongoose');

async function repairAttendanceSmart() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69ae76d0d0a86653c8f75c29?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to Tenant DB');

        const db = mongoose.connection.db;
        const attendanceCol = db.collection('attendances');

        const records = await attendanceCol.find({}).toArray();
        console.log(`Found ${records.length} records to check.`);

        let updatedCount = 0;
        for (const record of records) {
            const originalDate = new Date(record.date);
            if (!originalDate || isNaN(originalDate.getTime())) continue;

            // Check if it's near the IST midnight boundary (which manifests as ~18:30 UTC)
            // If it's between 18:00 and 19:00 UTC, it's almost certainly a localized Jan 00:00 IST record
            const hours = originalDate.getUTCHours();
            const minutes = originalDate.getUTCMinutes();
            
            let targetDate;
            if (hours === 18 && (minutes >= 25 && minutes <= 35)) {
                // This was meant to be 00:00 IST of the NEXT day.
                // e.g. 2025-12-31 18:30 UTC -> 2026-01-01 00:00 UTC
                targetDate = new Date(originalDate.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours to cross midnight
                targetDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
            } else {
                // Otherwise just normalize to UTC midnight of its OWN UTC day
                targetDate = new Date(Date.UTC(originalDate.getUTCFullYear(), originalDate.getUTCMonth(), originalDate.getUTCDate(), 0, 0, 0, 0));
            }

            if (originalDate.toISOString() !== targetDate.toISOString()) {
                console.log(`Updating ${originalDate.toISOString()} -> ${targetDate.toISOString()}`);
                await attendanceCol.updateOne(
                    { _id: record._id },
                    { $set: { date: targetDate } }
                );
                updatedCount++;
            }
        }

        console.log(`✅ Smart Repair complete. Updated ${updatedCount} records.`);

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

repairAttendanceSmart();
