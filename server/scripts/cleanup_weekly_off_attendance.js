/**
 * CLEANUP SCRIPT: Fix incorrect attendance records on weekly off days
 * 
 * This script finds attendance records that were marked as "present" on configured weekly off days
 * and corrects them to "weekly_off" status.
 * 
 * Usage: node cleanup_weekly_off_attendance.js <tenantId>
 * Example: node cleanup_weekly_off_attendance.js 507f1f77bcf86cd799439011
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const AttendanceSchema = require('../models/Attendance');
const AttendanceSettingsSchema = require('../models/AttendanceSettings');

async function cleanupWeeklyOffAttendance(tenantId) {
    try {
        console.log(`\n🔧 Starting cleanup for tenant: ${tenantId}\n`);

        // Connect to database
        const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';
        const db = mongoose.connection.useDb(`tenant_${tenantId}`);

        const Attendance = db.model('Attendance', AttendanceSchema);
        const AttendanceSettings = db.model('AttendanceSettings', AttendanceSettingsSchema);

        // Fetch settings
        const settings = await AttendanceSettings.findOne({ tenant: tenantId });
        if (!settings) {
            console.error('❌ Attendance settings not found for this tenant');
            process.exit(1);
        }

        const weeklyOffDays = settings.weeklyOffDays || [0];
        console.log(`📋 Weekly off days configured: ${weeklyOffDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}\n`);

        // Find all attendance records
        const allAttendance = await Attendance.find({ tenant: tenantId });
        console.log(`📊 Total attendance records: ${allAttendance.length}\n`);

        let correctedCount = 0;
        let errors = [];

        // Process each record
        for (const att of allAttendance) {
            const dateObj = new Date(att.date);
            const dayOfWeek = dateObj.getDay();

            // If status is 'present' but day is a weekly off
            if (weeklyOffDays.includes(dayOfWeek) && att.status !== 'weekly_off') {
                try {
                    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
                    
                    console.log(`⚙️  Correcting: ${att.date.toISOString().split('T')[0]} (${dayName})`);
                    console.log(`   Before: status = "${att.status}"`);

                    // Update to weekly_off
                    await Attendance.findByIdAndUpdate(
                        att._id,
                        {
                            $set: {
                                status: 'weekly_off',
                                correctionLog: {
                                    correctedAt: new Date(),
                                    previousStatus: att.status,
                                    reason: 'Automatic cleanup: Status corrected to match configured weekly off day'
                                }
                            }
                        },
                        { new: true }
                    );

                    console.log(`   After:  status = "weekly_off" ✅\n`);
                    correctedCount++;
                } catch (err) {
                    const errorMsg = `Failed to update record ${att._id}: ${err.message}`;
                    console.error(`   ❌ Error: ${errorMsg}\n`);
                    errors.push(errorMsg);
                }
            }
        }

        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ CLEANUP COMPLETE`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Records corrected: ${correctedCount}/${allAttendance.length}`);
        if (errors.length > 0) {
            console.log(`⚠️  Errors encountered: ${errors.length}`);
            errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
        }
        console.log(`${'='.repeat(60)}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Script Error:', error.message);
        process.exit(1);
    }
}

// Get tenant ID from command line
const tenantId = process.argv[2];
if (!tenantId) {
    console.error('❌ Usage: node cleanup_weekly_off_attendance.js <tenantId>');
    console.error('Example: node cleanup_weekly_off_attendance.js 507f1f77bcf86cd799439011');
    process.exit(1);
}

cleanupWeeklyOffAttendance(tenantId);
