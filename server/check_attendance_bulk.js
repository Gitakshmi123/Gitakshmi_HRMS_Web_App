const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const Tenant = require('./models/Tenant');
const getTenantDB = require('./utils/tenantDB');

const mongoURI = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'hrms_main';

if (!mongoURI) {
    console.error('❌ MONGO_URI not set in .env');
    process.exit(1);
}

async function checkAttendanceData() {
    try {
        // Connect to main database
        const connectOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: dbName
        };

        const conn = await mongoose.connect(mongoURI, connectOptions);
        console.log('✅ Connected to MongoDB main database');

        // Get all tenants from main db
        const tenants = await Tenant.find({}).lean();
        console.log(`\n📊 Found ${tenants.length} tenant(s)`);

        if (tenants.length === 0) {
            console.error('❌ No tenants found in the database');
            process.exit(1);
        }

        for (const tenant of tenants) {
            console.log(`\n🏢 Tenant: ${tenant.name} (ID: ${tenant._id}, Code: ${tenant.code})`);

            try {
                // Get tenant-specific database
                const tenantDb = await getTenantDB(tenant._id.toString());
                console.log(`   ✅ Connected to tenant database`);

                // Get Attendance model for this tenant
                const AttendanceSchema = require('./models/Attendance');
                const Attendance = tenantDb.model('Attendance', AttendanceSchema);

                // Count attendance records
                const attendanceCount = await Attendance.countDocuments({});
                console.log(`   📝 Total attendance records: ${attendanceCount}`);

                if (attendanceCount > 0) {
                    // Get recent records
                    const recentRecords = await Attendance
                        .find({})
                        .populate('employee', 'firstName lastName employeeId')
                        .sort({ createdAt: -1 })
                        .limit(5)
                        .lean();

                    console.log(`   📋 Recent 5 records:`);
                    recentRecords.forEach((rec, idx) => {
                        const date = new Date(rec.date).toLocaleDateString();
                        const status = rec.status || 'unknown';
                        const hours = rec.workingHours || 0;
                        const empName = rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : 'Unknown';
                        const uploaded = rec.isManualOverride ? '✓ (Uploaded)' : '✗ (System)';
                        console.log(`      ${idx + 1}. ${empName} | Date: ${date} | Status: ${status} | Hours: ${hours} | ${uploaded}`);
                    });

                    // Get statistics
                    const stats = await Attendance.aggregate([
                        {
                            $group: {
                                _id: null,
                                totalRecords: { $sum: 1 },
                                uploadedRecords: {
                                    $sum: { $cond: ['$isManualOverride', 1, 0] }
                                },
                                totalHours: { $sum: '$workingHours' },
                                uniqueEmployees: { $addToSet: '$employee' }
                            }
                        }
                    ]);

                    if (stats.length > 0) {
                        const stat = stats[0];
                        console.log(`\n   📊 Statistics:`);
                        console.log(`      Total records: ${stat.totalRecords}`);
                        console.log(`      Uploaded records: ${stat.uploadedRecords}`);
                        console.log(`      Unique employees: ${stat.uniqueEmployees.length}`);
                        console.log(`      Total hours: ${stat.totalHours.toFixed(2)}`);
                    }
                } else {
                    console.log(`   ⚠️  No attendance records found`);
                }

            } catch (err) {
                console.error(`   ❌ Error checking tenant: ${err.message}`);
            }
        }

        console.log('\n✅ Check complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAttendanceData();

