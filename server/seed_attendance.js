require('dotenv').config();
const mongoose = require('mongoose');

const EmployeeSchema = require('./models/Employee');
const AttendanceSchema = require('./models/Attendance');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const Tenant = mongoose.model('Tenant', require('./models/Tenant').schema || require('./models/Tenant'));
    let tenantDoc = await Tenant.findOne();
    if (!tenantDoc) {
      tenantDoc = new Tenant({ name: 'Demo Tenant', subdomain: 'demo' });
      await tenantDoc.save();
    }
    const tenantId = tenantDoc._id;

    const Employee = mongoose.model('Employee', EmployeeSchema);
    const Attendance = mongoose.model('Attendance', AttendanceSchema);

    // Create 2 dummy employees
    const emp1 = new Employee({
      firstName: 'Rahul',
      lastName: 'Kumar',
      employeeCode: 'E00123',
      employeeId: 'EMP_123_' + Date.now(),
      mainCompanyId: tenantId,
      tenant: tenantId,
      status: 'Active',
      designation: 'Software Engineer',
      shiftId: null,
      email: 'rahul.kumar@example.com'
    });

    const emp2 = new Employee({
      firstName: 'Priya',
      lastName: 'Sharma',
      employeeCode: 'E00124',
      employeeId: 'EMP_124_' + Date.now(),
      mainCompanyId: tenantId,
      tenant: tenantId,
      status: 'Active',
      designation: 'UI/UX Designer',
      shiftId: null,
      email: 'priya.sharma@example.com'
    });

    const savedEmp1 = await emp1.save();
    const savedEmp2 = await emp2.save();
    console.log('Saved employees');

    // Create attendance for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const att1 = new Attendance({
      tenant: tenantId,
      employee: savedEmp1._id,
      date: today,
      status: 'present',
      logs: [
        { type: 'IN', time: new Date(today.getTime() + 9 * 60 * 60 * 1000) }, // 9 AM
        { type: 'OUT', time: new Date(today.getTime() + 18 * 60 * 60 * 1000) } // 6 PM
      ]
    });

    const att2 = new Attendance({
      tenant: tenantId,
      employee: savedEmp2._id,
      date: today,
      status: 'half_day',
      logs: [
        { type: 'IN', time: new Date(today.getTime() + 9 * 60 * 60 * 1000) }, // 9 AM
        { type: 'OUT', time: new Date(today.getTime() + 13 * 60 * 60 * 1000) } // 1 PM
      ]
    });

    await att1.save();
    await att2.save();
    console.log('Saved attendance');

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
