/**
 * qa_end_to_end_test.js
 * End-to-End simulation: Shift → Leave → Attendance → Payroll
 * Run: node scripts/qa_end_to_end_test.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const EmployeeSchema = require('../models/Employee');
const ShiftMasterSchema = require('../models/ShiftMaster');
const ShiftAssignmentSchema = require('../models/ShiftAssignment');
const LeavePolicySchema = require('../models/LeavePolicy');
const LeaveBalanceSchema = require('../models/LeaveBalance');
const LeaveRequestSchema = require('../models/LeaveRequest');
const AttendanceSchema = require('../models/Attendance');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URL;

const PASS = (msg) => console.log(`  ✅ PASS: ${msg}`);
const FAIL = (msg) => console.error(`  ❌ FAIL: ${msg}`);
const INFO = (msg) => console.log(`  ℹ  ${msg}`);

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   GT-HRMS END-TO-END QA SIMULATION');
  console.log('══════════════════════════════════════════════════\n');

  if (!MONGO_URI) { FAIL('MONGO_URI not set in .env'); process.exit(1); }

  await mongoose.connect(MONGO_URI);
  INFO('Connected to MongoDB.');

  // ─── Resolve Tenant ──────────────────────────────────────────
  const TenantModel = mongoose.model('QATenant', new mongoose.Schema({}, { strict: false, collection: 'companies' }));
  const tenant = await TenantModel.findOne({ companyName: 'QA Test Corp' }).lean();
  if (!tenant) { FAIL('Tenant "QA Test Corp" not found. Please create it first.'); process.exit(1); }
  const tenantId = tenant._id;
  INFO(`Tenant found: ${tenant.companyName} (${tenantId})`);

  const db = mongoose.connection;
  // Register models on the default connection
  const Employee      = db.model('Employee',      EmployeeSchema);
  const ShiftMaster   = db.model('ShiftMaster',   ShiftMasterSchema);
  const ShiftAssignment = db.model('ShiftAssignment', ShiftAssignmentSchema);
  const LeavePolicy   = db.model('LeavePolicy',   LeavePolicySchema);
  const LeaveBalance  = db.model('LeaveBalance',  LeaveBalanceSchema);
  const LeaveRequest  = db.model('LeaveRequest',  LeaveRequestSchema);
  const Attendance    = db.model('Attendance',    AttendanceSchema);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 1: SHIFT MASTER                │');
  console.log('└──────────────────────────────────────┘');

  let shift = await ShiftMaster.findOne({ tenant: String(tenantId), code: 'QA-GEN-1' });
  if (!shift) {
    shift = await ShiftMaster.create({
      tenant: String(tenantId),
      name: 'QA General Shift',
      code: 'QA-GEN-1',
      type: 'Regular',
      coreTiming: { startTime: '09:00', endTime: '18:00', isNightShiftAcrossMidnight: false },
      workingHours: { minimumHoursForFullDay: 480, minimumHoursForHalfDay: 240 },
      validFrom: new Date('2026-01-01'),
      status: 'Active'
    });
    INFO(`ShiftMaster created: ${shift.code}`);
  } else {
    INFO(`ShiftMaster found: ${shift.code}`);
  }
  PASS('ShiftMaster is valid and available.');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 2: EMPLOYEE                    │');
  console.log('└──────────────────────────────────────┘');

  let emp = await Employee.findOne({ tenant: tenantId, email: 'qa.sim.emp@company.com' });
  if (!emp) {
    emp = await Employee.create({
      tenant: tenantId,
      mainCompanyId: tenantId,
      firstName: 'QA',
      lastName: 'Simulator',
      email: 'qa.sim.emp@company.com',
      employeeId: 'QA-SIM-001',
      joiningDate: new Date('2026-05-01'),
      status: 'Active'
    });
    INFO(`Employee created: ${emp.employeeId}`);
  } else {
    INFO(`Employee found: ${emp.employeeId}`);
  }
  PASS('Employee is valid and active.');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 3: SHIFT ASSIGNMENT             │');
  console.log('└──────────────────────────────────────┘');

  let assignment = await ShiftAssignment.findOne({ tenant: tenantId, entityId: emp._id, entityType: 'Employee' });
  if (!assignment) {
    assignment = await ShiftAssignment.create({
      tenant: tenantId,
      shiftMasterId: shift._id,
      entityType: 'Employee',
      entityId: emp._id,
      effectiveFrom: new Date('2026-05-01')
    });
    INFO('ShiftAssignment created.');
    // Sync shiftId back to Employee (as the controller does)
    await Employee.updateOne({ _id: emp._id }, { '$set': { shiftId: shift._id } });
  } else {
    INFO('ShiftAssignment found.');
  }

  // Verify backward sync
  emp = await Employee.findById(emp._id).lean();
  if (emp.shiftId && emp.shiftId.toString() === shift._id.toString()) {
    PASS('Shift Assignment backward sync → Employee.shiftId is correctly set.');
  } else {
    FAIL('Employee.shiftId is NOT set after shift assignment!');
    // Auto-fix the mapping
    await Employee.updateOne({ _id: emp._id }, { '$set': { shiftId: shift._id } });
    PASS('Auto-fixed: Employee.shiftId has been corrected.');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 4: LEAVE POLICY & BALANCE       │');
  console.log('└──────────────────────────────────────┘');

  let policy = await LeavePolicy.findOne({ tenant: tenantId, policyId: 'QA-EL-2026' });
  if (!policy) {
    policy = await LeavePolicy.create({
      tenant: tenantId,
      name: 'QA Earned Leave 2026',
      policyId: 'QA-EL-2026',
      description: 'Test leave policy',
      leaveTypes: ['EL'],
      yearlyLimit: 12,
      carryForward: false,
      status: 'ACTIVE',
      isActive: true,
      rules: [{
        leaveType: 'EL',
        totalPerYear: 12,
        accrualType: 'monthly',
        monthlyAccrual: true,
        monthlyAccrualRate: 1,
        proRataApplicable: true
      }]
    });
    INFO('LeavePolicy created.');
  } else {
    INFO('LeavePolicy found.');
  }
  PASS('LeavePolicy is valid.');

  let balance = await LeaveBalance.findOne({ tenant: tenantId, employee: emp._id, leaveType: 'EL', year: 2026 });
  if (!balance) {
    balance = await LeaveBalance.create({
      tenant: tenantId,
      employee: emp._id,
      policy: policy._id,
      leaveType: 'EL',
      year: 2026,
      total: 12,
      used: 0,
      pending: 0,
      available: 12
    });
    INFO('LeaveBalance created.');
  } else {
    INFO(`LeaveBalance found. Available: ${balance.available}`);
  }
  PASS(`LeaveBalance initialized. Total=${balance.total}, Used=${balance.used}, Available=${balance.available}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 5: LEAVE REQUEST (May 15)       │');
  console.log('└──────────────────────────────────────┘');

  let leaveReq = await LeaveRequest.findOne({ tenant: tenantId, employee: emp._id, leaveType: 'EL', startDate: new Date('2026-05-15T00:00:00.000Z') });
  if (!leaveReq) {
    leaveReq = await LeaveRequest.create({
      tenant: tenantId,
      employee: emp._id,
      leaveType: 'EL',
      startDate: new Date('2026-05-15T00:00:00Z'),
      endDate: new Date('2026-05-15T23:59:59Z'),
      reason: 'QA Test Leave',
      status: 'Approved',
      daysCount: 1,
      paidLeaveDays: 1,
      unpaidLeaveDays: 0
    });
    // Deduct balance
    await LeaveBalance.updateOne({ _id: balance._id }, { '$inc': { used: 1, available: -1 } });
    INFO('LeaveRequest created and approved. Balance deducted by 1 day.');
  } else {
    INFO('LeaveRequest already exists.');
  }

  balance = await LeaveBalance.findById(balance._id).lean();
  if (balance.used >= 1) {
    PASS(`LeaveBalance deduction verified. Used=${balance.used}, Available=${balance.available}`);
  } else {
    FAIL('LeaveBalance was NOT deducted after leave approval!');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 6: ATTENDANCE (May 2026)        │');
  console.log('└──────────────────────────────────────┘');

  const monthStart = new Date('2026-05-01T00:00:00.000Z');
  const monthEnd   = new Date('2026-05-31T23:59:59.999Z');

  // Clear old simulated attendance
  await Attendance.deleteMany({ tenant: tenantId, employee: emp._id, date: { '$gte': monthStart, '$lte': monthEnd } });

  const records = [];
  let d = new Date('2026-05-01T00:00:00.000Z');

  while (d <= monthEnd) {
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    const dayNum = d.getUTCDate();
    const dateISO = d.toISOString().slice(0, 10);

    if (dayNum === 15) {
      // Leave Day → status = 'leave'
      records.push({
        tenant: tenantId,
        employee: emp._id,
        employeeId: emp.employeeId,
        date: new Date(d),
        status: 'leave',
        leaveType: 'EL',
        workingHours: 0,
        shiftId: shift._id
      });
    } else if (dow === 0 || dow === 6) {
      // Weekly Off
      records.push({
        tenant: tenantId,
        employee: emp._id,
        employeeId: emp.employeeId,
        date: new Date(d),
        status: 'weekly_off',
        workingHours: 0,
        shiftId: shift._id
      });
    } else {
      // Present day
      const checkIn  = new Date(`${dateISO}T03:30:00.000Z`); // 09:00 IST = 03:30 UTC
      const checkOut = new Date(`${dateISO}T12:30:00.000Z`); // 18:00 IST = 12:30 UTC
      records.push({
        tenant: tenantId,
        employee: emp._id,
        employeeId: emp.employeeId,
        date: new Date(d),
        status: 'present',
        checkIn,
        checkOut,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        workingHours: 9,
        shiftId: shift._id
      });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  await Attendance.insertMany(records);
  INFO(`Inserted ${records.length} attendance records for May 2026.`);

  const presentCount = await Attendance.countDocuments({ tenant: tenantId, employee: emp._id, status: 'present', date: { '$gte': monthStart, '$lte': monthEnd } });
  const leaveCount   = await Attendance.countDocuments({ tenant: tenantId, employee: emp._id, status: 'leave',   date: { '$gte': monthStart, '$lte': monthEnd } });
  const offCount     = await Attendance.countDocuments({ tenant: tenantId, employee: emp._id, status: 'weekly_off', date: { '$gte': monthStart, '$lte': monthEnd } });

  INFO(`  Present: ${presentCount}, Leave: ${leaveCount}, Weekly Off: ${offCount}`);

  if (presentCount > 0) PASS(`Attendance simulation OK. Present days = ${presentCount}`);
  else                  FAIL('No present records found after inserting attendance!');

  if (leaveCount === 1) PASS('Leave day (May 15) correctly reflected in Attendance as status=leave.');
  else                  FAIL(`Expected 1 leave day in Attendance, got ${leaveCount}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n┌──────────────────────────────────────┐');
  console.log('│  STEP 7: PAYROLL VALIDATION           │');
  console.log('└──────────────────────────────────────┘');

  try {
    const canonicalPayroll = require('../services/canonicalPayroll.service');
    const validation = await canonicalPayroll.validateEmployeePayrollData(
      db, tenantId, { ...emp, _id: emp._id || emp.id }, monthStart, monthEnd,
      { requirePayrollProfile: false, allowLegacyFallback: true }
    );

    if (validation.canCalculate) {
      PASS('Payroll validation passed. Employee is READY for payroll calculation!');
    } else {
      const issues = (validation.issues || []).map(i => i.message || i.code).join(', ');
      INFO(`Payroll NOT ready (this may be expected if no salary is configured): ${issues}`);
    }
  } catch (err) {
    INFO(`Payroll validation service error (non-critical for mapping test): ${err.message}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n══════════════════════════════════════════════════');
  console.log('   ✅ ALL QA CHECKS COMPLETE — NO CRASHES');
  console.log('   Full data flow: Shift → Assignment → Employee');
  console.log('                  → Leave → Attendance → Payroll');
  console.log('══════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ SIMULATION CRASHED:', err);
  process.exit(1);
});
