require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function run() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to main MongoDB');

  const targetFirst = /dharmik/i;
  const targetLast = /jethwani/i;

  // Month optional arg in YYYY-MM
  const monthArg = process.argv[2];
  const now = new Date();
  const [yearStr, monthStr] = (monthArg || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'))).split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!year || !month) {
    console.error('Invalid month argument. Use YYYY-MM');
    process.exit(1);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const daysInMonth = endDate.getDate();

  const tenants = await Tenant.find({}).lean();
  if (!tenants || tenants.length === 0) {
    console.error('No tenants found');
    process.exit(1);
  }

  let found = false;

  for (const t of tenants) {
    const tenantId = t._id.toString();
    console.log(`Checking tenant: ${t.name} (${tenantId})`);
    const tenantDB = await getTenantDB(tenantId);
    const Employee = tenantDB.model('Employee');
    const Attendance = tenantDB.model('Attendance');

    const emp = await Employee.findOne({ firstName: targetFirst, lastName: targetLast }).lean();
    if (!emp) continue;

    found = true;
    console.log(`Found employee in tenant ${t.name}: ${emp.firstName} ${emp.lastName} (${emp._id})`);

    // Prepare 20 dates: choose first 20 days that exist in month
    const dates = [];
    for (let d = 1; d <= daysInMonth && dates.length < 20; d++) {
      const dt = new Date(year, month - 1, d);
      dates.push(dt);
    }

    // Upsert attendance records
    for (const dt of dates) {
      const dateOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const checkIn = new Date(dateOnly);
      checkIn.setHours(9, 30, 0, 0);
      const checkOut = new Date(dateOnly);
      checkOut.setHours(18, 0, 0, 0);

      try {
        await Attendance.updateOne(
          { tenant: tenantId, employee: emp._id, date: dateOnly },
          {
            $set: {
              tenant: tenantId,
              employee: emp._id,
              date: dateOnly,
              status: 'present',
              checkIn,
              checkOut,
              isManualOverride: true,
              overrideReason: 'Set by script: ensure 20 present days for payroll testing'
            }
          },
          { upsert: true }
        );
        console.log(`Upserted attendance for ${dateOnly.toISOString().slice(0,10)}`);
      } catch (e) {
        console.error('Failed to upsert', e.message);
      }
    }

    console.log(`Completed setting ${dates.length} attendance records for ${emp.firstName} ${emp.lastName}`);
    break; // Stop after first found
  }

  if (!found) {
    console.error('Employee Dharmik Jethwani not found in any tenant');
  }

  await mongoose.connection.close();
  console.log('Done');
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
