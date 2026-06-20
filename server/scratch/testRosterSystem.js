const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const getTenantDB = require('../utils/tenantDB');

async function testRosterSystem() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);

  const tenantId = '69f8ce66319fbe2bc13704ca';
  console.log('Using Tenant:', tenantId);
  const db = await getTenantDB(tenantId);

  // 1. Resolve Models
  const Roster = db.model('Roster', require('../models/Roster'));
  const RosterAssignment = db.model('RosterAssignment', require('../models/RosterAssignment'));
  const RosterRotation = db.model('RosterRotation', require('../models/RosterRotation'));
  const Employee = db.model('Employee', require('../models/Employee'));
  const ShiftMaster = db.model('ShiftMaster', require('../models/ShiftMaster'));
  const EmployeeRoster = db.model('EmployeeRoster', require('../models/EmployeeRoster'));
  const LeaveRequest = db.model('LeaveRequest', require('../models/LeaveRequest'));

  console.log('\n--- Step 1: Loading test documents ---');
  
  // Find or create test Shift Masters (Morning, Evening, Night)
  let shifts = await ShiftMaster.find({ tenant: tenantId }).limit(3);
  if (shifts.length < 3) {
    console.log('Creating mock Shift Masters for testing...');
    const shiftData = [
      { 
        tenant: new mongoose.Types.ObjectId(tenantId), 
        name: 'Morning Shift', 
        code: 'MORN', 
        coreTiming: { startTime: '09:00', endTime: '18:00' }, 
        workingHours: { minimumHoursForFullDay: 480, minimumHoursForHalfDay: 240 },
        validFrom: new Date(),
        colorCode: '#52c41a', 
        status: 'Active' 
      },
      { 
        tenant: new mongoose.Types.ObjectId(tenantId), 
        name: 'Evening Shift', 
        code: 'EVE', 
        coreTiming: { startTime: '14:00', endTime: '23:00' }, 
        workingHours: { minimumHoursForFullDay: 480, minimumHoursForHalfDay: 240 },
        validFrom: new Date(),
        colorCode: '#1890ff', 
        status: 'Active' 
      },
      { 
        tenant: new mongoose.Types.ObjectId(tenantId), 
        name: 'Night Shift', 
        code: 'NIGHT', 
        coreTiming: { startTime: '22:00', endTime: '07:00', isNightShiftAcrossMidnight: true }, 
        workingHours: { minimumHoursForFullDay: 480, minimumHoursForHalfDay: 240 },
        validFrom: new Date(),
        colorCode: '#722ed1', 
        status: 'Active' 
      }
    ];
    shifts = await ShiftMaster.insertMany(shiftData);
  }
  console.log(`Loaded ${shifts.length} Shift Masters: ${shifts.map(s => `${s.code} (${s.name})`).join(', ')}`);

  // Find or create test Employee
  let employee = await Employee.findOne({ $or: [{ mainCompanyId: tenantId }, { tenant: tenantId }] });
  if (!employee) {
    console.log('Creating a mock employee for testing...');
    employee = new Employee({
      firstName: 'QA_Test',
      lastName: 'User',
      employeeId: 'QA101',
      status: 'Active',
      tenant: tenantId,
      mainCompanyId: new mongoose.Types.ObjectId(tenantId),
      email: 'qa@example.com'
    });
    await employee.save();
  }
  console.log(`Using Employee: ${employee.firstName} ${employee.lastName} (${employee._id})`);

  // 2. Create Roster Master
  console.log('\n--- Step 2: Initializing Roster Master ---');
  await Roster.deleteMany({ tenant: tenantId, month: 6, year: 2026 });
  const testRoster = new Roster({
    tenant: tenantId,
    rosterName: 'QA Roster June 2026',
    month: 6,
    year: 2026,
    rosterType: 'Weekly Rotation',
    employees: [employee._id],
    status: 'Draft'
  });
  await testRoster.save();
  console.log(`Roster Master Created: ${testRoster.rosterName} (ID: ${testRoster._id})`);

  // 3. Create Rotation Pattern
  console.log('\n--- Step 3: Setting Up Rotation Pattern ---');
  await RosterRotation.deleteMany({ tenant: tenantId, patternName: 'QA Weekly Rotation Cycle' });
  const rotation = new RosterRotation({
    tenant: tenantId,
    patternName: 'QA Weekly Rotation Cycle',
    description: 'Morning -> Evening -> Night',
    rotationType: 'Weekly',
    sequence: [shifts[0]._id, shifts[1]._id, shifts[2]._id],
    isActive: true
  });
  await rotation.save();
  console.log(`Rotation Pattern Created: ${rotation.patternName} with sequence: ${shifts.map(s => s.code).join(' -> ')}`);

  // 4. Auto-Generate Roster Assignments
  console.log('\n--- Step 4: Auto-Generating Roster Assignments ---');
  const enterpriseRosterController = require('../controllers/enterpriseRoster.controller');
  
  // Mock Express Req/Res
  let responseData = null;
  const req = {
    tenantDB: db,
    headers: { 'x-tenant-id': tenantId },
    body: { rosterId: testRoster._id, rotationId: rotation._id },
    user: { _id: new mongoose.Types.ObjectId() }
  };
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      responseData = data;
      return this;
    }
  };

  await enterpriseRosterController.generateRoster(req, res);
  console.log('Generate Response:', responseData);
  
  if (!responseData.success) {
    throw new Error('Roster generation failed: ' + JSON.stringify(responseData));
  }

  // Retrieve assigned weeks
  const assignments = await RosterAssignment.find({ rosterId: testRoster._id }).populate('shiftId').lean();
  console.log(`Generated ${assignments.length} assignments:`);
  assignments.forEach(a => {
    console.log(`  Week ${a.weekNo}: Shift = ${a.shiftId.code} (${a.shiftId.name}) from ${a.startDate.toISOString().substring(0, 10)} to ${a.endDate.toISOString().substring(0, 10)}`);
  });

  // 5. Conflict Validation Check
  console.log('\n--- Step 5: Creating Conflict and Validating ---');
  // Create an approved leave request for the employee that overlaps with Week 1 (June 1 - June 7)
  await LeaveRequest.deleteMany({ employee: employee._id, leaveType: 'Casual' });
  const leave = new LeaveRequest({
    tenant: tenantId,
    employee: employee._id,
    leaveType: 'Casual',
    startDate: new Date('2026-06-03'),
    endDate: new Date('2026-06-05'),
    status: 'Approved',
    appliedDays: 3
  });
  await leave.save();
  console.log(`Mock Leave Request Created: Approved Leave from ${leave.startDate.toISOString().substring(0, 10)} to ${leave.endDate.toISOString().substring(0, 10)}`);

  // Run validation
  let validationData = null;
  const valReq = {
    tenantDB: db,
    headers: { 'x-tenant-id': tenantId },
    body: { rosterId: testRoster._id }
  };
  const valRes = {
    status: function(code) { return this; },
    json: function(data) {
      validationData = data;
      return this;
    }
  };
  await enterpriseRosterController.validateRosterConflicts(valReq, valRes);
  console.log('Validation Conflicts:', validationData.conflicts);
  console.log('Validation Warnings (Fair Rotation):', validationData.warnings);

  if (validationData.conflicts.length === 0) {
    throw new Error('Failed to catch Leave Conflict!');
  }
  console.log('✓ Successfully caught Leave Conflict!');

  // 6. Manual Shift Modification Grid Check
  console.log('\n--- Step 6: Testing Manual Shift Modifications ---');
  // Update Week 1 shift to Evening instead of Morning
  const modReq = {
    tenantDB: db,
    headers: { 'x-tenant-id': tenantId },
    body: {
      rosterId: testRoster._id,
      assignments: [
        {
          employeeId: employee._id,
          shiftId: shifts[1]._id, // Evening Shift
          weekNo: 1,
          startDate: assignments[0].startDate,
          endDate: assignments[0].endDate
        }
      ]
    }
  };
  let modResponse = null;
  const modRes = {
    status: function(code) { return this; },
    json: function(data) {
      modResponse = data;
      return this;
    }
  };
  await enterpriseRosterController.saveAssignments(modReq, modRes);
  console.log('Save Assignments Response:', modResponse);

  const updatedAssign = await RosterAssignment.findOne({ rosterId: testRoster._id, weekNo: 1 }).populate('shiftId');
  console.log(`Updated Week 1 Shift: ${updatedAssign.shiftId.code} (${updatedAssign.shiftId.name})`);
  if (updatedAssign.shiftId.code !== 'EVE') {
    throw new Error('Manual assignment update failed!');
  }
  console.log('✓ Successfully saved manual shift modifications!');

  // 7. Publish and Sync Legacy
  console.log('\n--- Step 7: Publishing Roster and Syncing Legacy ---');
  const pubReq = {
    tenantDB: db,
    headers: { 'x-tenant-id': tenantId },
    body: { rosterId: testRoster._id },
    user: { _id: new mongoose.Types.ObjectId() }
  };
  let pubResponse = null;
  const pubRes = {
    status: function(code) { return this; },
    json: function(data) {
      pubResponse = data;
      return this;
    }
  };
  await enterpriseRosterController.publishRoster(pubReq, pubRes);
  console.log('Publish Response:', pubResponse);

  // Check if legacy daily entries are generated in EmployeeRoster
  const dailyRecords = await EmployeeRoster.find({
    tenant: tenantId,
    employeeId: employee._id,
    date: { $gte: new Date('2026-06-01'), $lte: new Date('2026-06-07') }
  }).populate('shiftMasterId');

  console.log(`Generated ${dailyRecords.length} daily roster records for Week 1:`);
  dailyRecords.forEach(d => {
    console.log(`  Date: ${d.date.toISOString().substring(0, 10)} | Shift Assigned: ${d.shiftMasterId.code}`);
  });

  if (dailyRecords.length === 0 || dailyRecords[0].shiftMasterId.code !== 'EVE') {
    throw new Error('Publishing legacy synchronization failed!');
  }
  console.log('✓ Successfully published and synchronized legacy roster!');

  console.log('\n=============================================');
  console.log('✓ ALL ENTERPRISE ROSTER QA FLOWS ARE FULLY VERIFIED AND WORKING!');
  console.log('=============================================');

  await mongoose.disconnect();
  process.exit(0);
}

testRosterSystem().catch(err => {
  console.error('QA Test Failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
