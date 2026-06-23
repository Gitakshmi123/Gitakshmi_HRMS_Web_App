const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const payrollComponentSeeder = require('./payrollComponentSeeder');
const canonicalPayroll = require('./canonicalPayroll.service');

const DEMO_SEED_KEY = 'gitakshmi-demo-seed-v1';

function getTenantModel(tenantDB, name, schemaPath) {
  if (tenantDB.models?.[name]) return tenantDB.models[name];
  const schemaOrModel = require(schemaPath);
  return tenantDB.model(name, schemaOrModel?.schema || schemaOrModel);
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function atTime(value, hour, minute = 0) {
  const date = startOfDay(value);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function upsertOne(Model, filter, payload, counters, bucket) {
  const exists = await Model.exists(filter);
  const doc = await Model.findOneAndUpdate(
    filter,
    { $set: payload, $setOnInsert: { createdAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  counters[bucket] = counters[bucket] || { created: 0, updated: 0 };
  counters[bucket][exists ? 'updated' : 'created'] += 1;
  return doc;
}

function attendancePath(baseLat, baseLng, date, index) {
  return Array.from({ length: 5 }).map((_, step) => ({
    lat: Number((baseLat + index * 0.002 + step * 0.0004).toFixed(6)),
    lng: Number((baseLng + index * 0.002 + step * 0.0004).toFixed(6)),
    accuracy: 18 + step,
    speed: step === 0 ? 0 : 2.2,
    heading: 70,
    timestamp: atTime(date, 9 + step, step * 8),
    source: step === 0 ? 'CHECK_IN' : 'TRACKER'
  }));
}

async function seedDemoData({ tenantDB, tenantId, user }) {
  if (!tenantDB || !tenantId || !mongoose.Types.ObjectId.isValid(String(tenantId))) {
    const error = new Error('A valid tenant/company is required before demo data can be seeded.');
    error.status = 400;
    throw error;
  }

  const tenant = new mongoose.Types.ObjectId(String(tenantId));
  const Department = getTenantModel(tenantDB, 'Department', '../models/Department');
  const Grade = getTenantModel(tenantDB, 'Grade', '../models/Grade');
  const Position = getTenantModel(tenantDB, 'Position', '../models/Position');
  const Employee = getTenantModel(tenantDB, 'Employee', '../models/Employee');
  const Attendance = getTenantModel(tenantDB, 'Attendance', '../models/Attendance');
  const LeaveRequest = getTenantModel(tenantDB, 'LeaveRequest', '../models/LeaveRequest');
  const Requirement = getTenantModel(tenantDB, 'Requirement', '../models/Requirement');
  const TrackerCandidate = getTenantModel(tenantDB, 'TrackerCandidate', '../models/TrackerCandidate');
  const Ticket = getTenantModel(tenantDB, 'Ticket', '../models/Ticket');
  const SalaryComponent = getTenantModel(tenantDB, 'SalaryComponent', '../models/SalaryComponent');
  const SalaryTemplate = getTenantModel(tenantDB, 'SalaryTemplate', '../models/SalaryTemplate');
  const SalaryAssignment = getTenantModel(tenantDB, 'SalaryAssignment', '../models/SalaryAssignment');
  const EmployeeCompensation = getTenantModel(tenantDB, 'EmployeeCompensation', '../models/EmployeeCompensation');
  const PayrollRun = getTenantModel(tenantDB, 'PayrollRun', '../models/PayrollRun');
  const Payslip = getTenantModel(tenantDB, 'Payslip', '../models/Payslip');
  const BGVCase = getTenantModel(tenantDB, 'BGVCase', '../models/BGVCase');
  const BGVCheck = getTenantModel(tenantDB, 'BGVCheck', '../models/BGVCheck');

  const counters = {};
  const now = new Date();
  const passwordHash = await bcrypt.hash('Demo@12345', 10);

  const departments = [];
  for (const item of [
    ['Human Resources', 'DEMO_HR'],
    ['Engineering', 'DEMO_ENG'],
    ['Sales', 'DEMO_SAL'],
    ['Finance', 'DEMO_FIN']
  ]) {
    departments.push(await upsertOne(Department, { mainCompanyId: tenant, code: item[1], 'meta.demoSeedKey': DEMO_SEED_KEY }, {
      name: item[0],
      code: item[1],
      departmentCode: item[1],
      mainCompanyId: tenant,
      budgetedHeadcount: 10,
      isActive: true,
      isDeleted: false,
      description: item[0] + ' demo department',
      meta: { demoSeedKey: DEMO_SEED_KEY }
    }, counters, 'departments'));
  }

  const grades = [];
  for (const item of [['Associate', 'DEMO_G1', 1], ['Senior Associate', 'DEMO_G2', 2], ['Manager', 'DEMO_M1', 3]]) {
    grades.push(await upsertOne(Grade, { tenant, code: item[1], isDeleted: false }, {
      tenant,
      name: item[0],
      normalizedName: item[0].toLowerCase(),
      code: item[1],
      level: item[2],
      description: item[0] + ' demo grade',
      isActive: true,
      isDeleted: false
    }, counters, 'grades'));
  }

  // Seed default payroll components
  await payrollComponentSeeder.seedDefaultComponents(tenantDB, tenant);

  // Seed default salary template
  const defaultTemplate = await upsertOne(SalaryTemplate, { tenantId: tenant, templateName: 'Standard Demo Template' }, {
    tenantId: tenant,
    templateName: 'Standard Demo Template',
    templateType: 'STANDARD',
    description: 'Standard salary template for demo setup',
    annualCTC: 600000,
    monthlyCTC: 50000,
    earnings: [
      { name: 'Basic', componentCode: 'Basic', calculationType: 'PERCENT_CTC', percentage: 50, monthlyAmount: 25000, annualAmount: 300000, proRata: true, taxable: true, isRemovable: false, enabled: true },
      { name: 'House Rent Allowance', componentCode: 'House Rent Allowance', calculationType: 'PERCENT_BASIC', percentage: 40, monthlyAmount: 10000, annualAmount: 120000, proRata: true, taxable: true, isRemovable: true, enabled: true },
      { name: 'Conveyance Allowance', componentCode: 'Conveyance Allowance', calculationType: 'FIXED', monthlyAmount: 1600, annualAmount: 19200, proRata: true, taxable: false, isRemovable: true, enabled: true }
    ],
    employerDeductions: [
      { name: 'Provident Fund (Employer)', componentCode: 'Provident Fund (Employer)', calculationType: 'PERCENT_PF_WAGE', percentage: 12, monthlyAmount: 1800, annualAmount: 21600, enabled: true },
      { name: 'Gratuity', componentCode: 'Gratuity', calculationType: 'PERCENT_BASIC', percentage: 4.81, monthlyAmount: 1202.5, annualAmount: 14430, enabled: true }
    ],
    employeeDeductions: [
      { name: 'Provident Fund (Employee)', componentCode: 'Provident Fund (Employee)', category: 'POST_TAX', amountType: 'PERCENTAGE', calculationBase: 'BASIC', amountValue: 12, monthlyAmount: 1800, enabled: true },
      { name: 'Professional Tax', componentCode: 'Professional Tax', category: 'POST_TAX', amountType: 'FIXED', amountValue: 200, monthlyAmount: 200, enabled: true }
    ],
    settings: {
      includePensionScheme: true,
      includeESI: false,
      pfWageRestriction: true,
      pfWageLimit: 15000
    },
    isAssigned: true,
    isActive: true
  }, counters, 'salaryTemplates');

  const positions = [];
  for (const [index, item] of [
    ['DEMO-POS-HR-001', 'HR Executive', 'DEMO_HR', 300000, 520000],
    ['DEMO-POS-ENG-001', 'Frontend Developer', 'DEMO_ENG', 600000, 1100000],
    ['DEMO-POS-SAL-001', 'Sales Manager', 'DEMO_SAL', 700000, 1300000]
  ].entries()) {
    const department = departments.find((dept) => dept.code === item[2]) || departments[0];
    positions.push(await upsertOne(Position, { tenant, positionId: item[0] }, {
      tenant,
      positionId: item[0],
      jobTitle: item[1],
      department: department.name,
      departmentId: department._id,
      baseSalaryRange: { min: item[3], max: item[4] },
      budgetedCount: 3,
      currentCount: index === 0 ? 1 : 0,
      level: index === 2 ? 'Manager' : 'Associate',
      status: 'Vacant',
      hiringStatus: 'Open',
      metadata: { demoSeedKey: DEMO_SEED_KEY }
    }, counters, 'positions'));
  }

  const employeeSpecs = [
    ['DEMO001', 'Aarav', 'Shah', 'Male', 'Human Resources', 'HR Executive', 420000],
    ['DEMO002', 'Priya', 'Patel', 'Female', 'Engineering', 'Frontend Developer', 900000],
    ['DEMO003', 'Rohan', 'Mehta', 'Male', 'Engineering', 'Backend Developer', 960000],
    ['DEMO004', 'Neha', 'Trivedi', 'Female', 'Sales', 'Sales Manager', 1080000],
    ['DEMO005', 'Karan', 'Joshi', 'Male', 'Finance', 'Payroll Specialist', 620000],
    ['DEMO006', 'Isha', 'Desai', 'Female', 'Human Resources', 'Talent Acquisition Executive', 540000]
  ];

  const employees = [];
  const payslipRecords = [];
  for (const [index, item] of employeeSpecs.entries()) {
    const department = departments.find((dept) => dept.name === item[4]) || departments[0];
    const grade = grades[index % grades.length];
    const employee = await upsertOne(Employee, { employeeId: item[0] }, {
      tenant,
      mainCompanyId: tenant,
      departmentId: department._id,
      department: department.name,
      employeeId: item[0],
      employeeCode: item[0],
      firstName: item[1],
      lastName: item[2],
      gender: item[3],
      email: item[0].toLowerCase() + '@demo.gitakshmi.local',
      personalEmail: item[1].toLowerCase() + '.' + item[2].toLowerCase() + '@example.com',
      contactNo: '90000010' + index,
      status: 'ACTIVE',
      isActive: true,
      isDeleted: false,
      password: passwordHash,
      role: index === 0 ? 'hr' : 'employee',
      designation: item[5],
      grade: grade.name,
      gradeId: grade._id,
      salary: item[6],
      joiningDate: addDays(now, -180 + index * 11),
      dob: addDays(now, -9000 - index * 300),
      maritalStatus: index % 2 === 0 ? 'Single' : 'Married',
      bloodGroup: ['O+', 'A+', 'B+', 'AB+', 'O-', 'B-'][index],
      state: 'Gujarat',
      workState: 'Gujarat',
      workCity: 'Ahmedabad',
      category: 'SKILLED',
      employeeType: 'Full-time',
      workMode: index === 3 ? 'Field / Onsite' : 'Work From Office (WFO)',
      leaveBalance: { SL: 6, PL: 12, CL: 6, LWP: 0, EL: 4 },
      bankDetails: { bankName: 'Demo National Bank', accountNumber: '501000000' + (index + 1), ifsc: 'DEMO0001234', branchName: 'Ahmedabad' },
      documents: { aadharNumber: '99998888777' + index, panNumber: 'DEMOA12' + index + 'Z' },
      tempAddress: { city: 'Ahmedabad', state: 'Gujarat', country: 'India', pinCode: '380015' },
      permAddress: { city: 'Ahmedabad', state: 'Gujarat', country: 'India', pinCode: '380015' },
      meta: { demoSeedKey: DEMO_SEED_KEY }
    }, counters, 'employees');

    // Seed EmployeeCompensation and SalaryAssignment for payroll
    const annualCTC = item[6];
    const monthlyCTC = Math.round((annualCTC / 12) * 100) / 100;
    const basicMonthly = Math.round((monthlyCTC * 0.5) * 100) / 100;
    const basicAnnual = basicMonthly * 12;
    const hraMonthly = Math.round((basicMonthly * 0.4) * 100) / 100;
    const hraAnnual = hraMonthly * 12;
    const erPfMonthly = Math.round((basicMonthly * 0.12) * 100) / 100;
    const erPfAnnual = erPfMonthly * 12;
    const gratuityMonthly = Math.round((basicMonthly * 0.0481) * 100) / 100;
    const gratuityAnnual = gratuityMonthly * 12;
    const otherMonthly = Math.round((monthlyCTC - (basicMonthly + hraMonthly + erPfMonthly + gratuityMonthly)) * 100) / 100;
    const otherAnnual = otherMonthly * 12;

    const eePfMonthly = Math.round((basicMonthly * 0.12) * 100) / 100;
    const eePfAnnual = eePfMonthly * 12;
    const ptMonthly = 200;
    const ptAnnual = 2400;

    const grossMonthly = basicMonthly + hraMonthly + otherMonthly;
    const grossAnnual = grossMonthly * 12;
    const totalDeductionsMonthly = eePfMonthly + ptMonthly;
    const netMonthly = grossMonthly - totalDeductionsMonthly;

    const breakup = {
      earnings: [
        { name: 'Basic', code: 'Basic', monthly: basicMonthly, yearly: basicAnnual },
        { name: 'House Rent Allowance', code: 'House Rent Allowance', monthly: hraMonthly, yearly: hraAnnual },
        { name: 'Other Allowance', code: 'Other Allowance', monthly: otherMonthly, yearly: otherAnnual }
      ],
      deductions: [
        { name: 'Provident Fund (Employee)', code: 'Provident Fund (Employee)', monthly: eePfMonthly, yearly: eePfAnnual },
        { name: 'Professional Tax', code: 'Professional Tax', monthly: ptMonthly, yearly: ptAnnual }
      ],
      benefits: [
        { name: 'Provident Fund (Employer)', code: 'Provident Fund (Employer)', monthly: erPfMonthly, yearly: erPfAnnual },
        { name: 'Gratuity', code: 'Gratuity', monthly: gratuityMonthly, yearly: gratuityAnnual }
      ],
      totals: {
        totalCTC: annualCTC,
        grossA_Yearly: grossAnnual,
        grossB_Yearly: erPfAnnual + gratuityAnnual,
        takeHomeMonthly: netMonthly
      }
    };

    const compComponents = [
      { name: 'Basic', code: 'Basic', monthlyAmount: basicMonthly, annualAmount: basicAnnual, type: 'EARNING' },
      { name: 'House Rent Allowance', code: 'House Rent Allowance', monthlyAmount: hraMonthly, annualAmount: hraAnnual, type: 'EARNING' },
      { name: 'Other Allowance', code: 'Other Allowance', monthlyAmount: otherMonthly, annualAmount: otherAnnual, type: 'EARNING' },
      { name: 'Provident Fund (Employee)', code: 'Provident Fund (Employee)', monthlyAmount: eePfMonthly, annualAmount: eePfAnnual, type: 'DEDUCTION' },
      { name: 'Professional Tax', code: 'Professional Tax', monthlyAmount: ptMonthly, annualAmount: ptAnnual, type: 'DEDUCTION' },
      { name: 'Provident Fund (Employer)', code: 'Provident Fund (Employer)', monthlyAmount: erPfMonthly, annualAmount: erPfAnnual, type: 'BENEFIT' },
      { name: 'Gratuity', code: 'Gratuity', monthlyAmount: gratuityMonthly, annualAmount: gratuityAnnual, type: 'BENEFIT' }
    ];

    await upsertOne(EmployeeCompensation, { employeeId: employee._id, companyId: tenant }, {
      companyId: tenant,
      employeeId: employee._id,
      totalCTC: annualCTC,
      grossA: grossAnnual,
      grossB: erPfAnnual + gratuityAnnual,
      components: compComponents,
      category: 'SKILLED',
      effectiveFrom: employee.joiningDate,
      createdBy: user?.id || user?._id || null,
      isActive: true,
      status: 'ACTIVE'
    }, counters, 'employeeCompensations');

    await upsertOne(SalaryAssignment, { tenantId: tenant, employeeId: employee._id }, {
      tenantId: tenant,
      employeeId: employee._id,
      salaryTemplateId: defaultTemplate._id,
      ctcAnnual: annualCTC,
      monthlyCTC: monthlyCTC,
      earnings: breakup.earnings.map(e => ({ name: e.name, code: e.code, monthlyAmount: e.monthly, annualAmount: e.yearly })),
      deductions: breakup.deductions.map(d => ({ name: d.name, code: d.code, monthlyAmount: d.monthly, annualAmount: d.yearly })),
      benefits: breakup.benefits.map(b => ({ name: b.name, code: b.code, monthlyAmount: b.monthly, annualAmount: b.yearly })),
      breakup: breakup,
      category: 'SKILLED',
      state: 'Gujarat',
      netSalaryMonthly: netMonthly,
      effectiveFrom: employee.joiningDate,
      assignedBy: user?.id || user?._id || null
    }, counters, 'salaryAssignments');

    employee.salaryTemplateId = defaultTemplate._id;
    await employee.save();

    payslipRecords.push({
      employeeId: employee._id,
      employeeInfo: {
        employeeId: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        designation: employee.designation,
        bankAccountNumber: employee.bankDetails?.accountNumber,
        bankIFSC: employee.bankDetails?.ifsc,
        bankName: employee.bankDetails?.bankName,
        panNumber: employee.documents?.panNumber,
        gender: employee.gender,
        dob: employee.dob,
        joiningDate: employee.joiningDate
      },
      earningsSnapshot: [
        { name: 'Basic', amount: basicMonthly, isProRata: false, originalAmount: basicMonthly },
        { name: 'House Rent Allowance', amount: hraMonthly, isProRata: false, originalAmount: hraMonthly },
        { name: 'Other Allowance', amount: otherMonthly, isProRata: false, originalAmount: otherMonthly }
      ],
      preTaxDeductionsSnapshot: [
        { name: 'Provident Fund (Employee)', amount: eePfMonthly, category: 'EPF' },
        { name: 'Professional Tax', amount: ptMonthly, category: 'PROFESSIONAL_TAX' }
      ],
      postTaxDeductionsSnapshot: [],
      employerContributionsSnapshot: [
        { name: 'Provident Fund (Employer)', amount: erPfMonthly },
        { name: 'Gratuity', amount: gratuityMonthly }
      ],
      grossEarnings: grossMonthly,
      preTaxDeductionsTotal: totalDeductionsMonthly,
      taxableIncome: grossMonthly - totalDeductionsMonthly,
      incomeTax: 0,
      postTaxDeductionsTotal: 0,
      netPay: netMonthly,
      salaryTemplateId: defaultTemplate._id,
      salaryTemplateSnapshot: {
        templateName: defaultTemplate.templateName,
        annualCTC: annualCTC,
        monthlyCTC: monthlyCTC
      }
    });

    employees.push(employee);
  }

  for (const department of departments) {
    const headcount = employees.filter((employee) => String(employee.departmentId || '') === String(department._id)).length;
    await Department.updateOne({ _id: department._id }, { $set: { currentHeadcount: headcount } });
  }

  for (const [employeeIndex, employee] of employees.entries()) {
    for (let offset = -9; offset <= 0; offset += 1) {
      const date = startOfDay(addDays(now, offset));
      const isWeekend = date.getDay() === 0;
      const isLeave = employeeIndex === 2 && offset === -2;
      const isLate = employeeIndex === 3 && offset === -1;
      const status = isWeekend ? 'weekly_off' : isLeave ? 'leave' : 'present';
      const checkIn = status === 'present' ? atTime(date, isLate ? 10 : 9, isLate ? 18 : 5) : null;
      const checkOut = status === 'present' ? atTime(date, 18, employeeIndex % 2 ? 10 : 0) : null;
      const points = status === 'present' ? attendancePath(23.0225, 72.5714, date, employeeIndex) : [];
      const firstPoint = points[0] || {};
      const lastPoint = points[points.length - 1] || {};

      await upsertOne(Attendance, { tenant, employee: employee._id, date }, {
        tenant,
        employee: employee._id,
        employeeId: employee.employeeId,
        date,
        status,
        leaveType: isLeave ? 'CL' : undefined,
        checkIn,
        checkOut,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        logs: checkIn ? [
          { time: checkIn, type: 'IN', device: 'Demo Device', location: 'Ahmedabad Office', method: 'GPS', latitude: firstPoint.lat, longitude: firstPoint.lng, accuracy: 20 },
          { time: checkOut, type: 'OUT', device: 'Demo Device', location: 'Ahmedabad Office', method: 'GPS', latitude: lastPoint.lat, longitude: lastPoint.lng, accuracy: 22 }
        ] : [],
        checkInLocation: checkIn ? { lat: firstPoint.lat, lng: firstPoint.lng, accuracy: 20, timestamp: checkIn } : {},
        checkOutLocation: checkOut ? { lat: lastPoint.lat, lng: lastPoint.lng, accuracy: 22, timestamp: checkOut } : {},
        lat: firstPoint.lat || null,
        lng: firstPoint.lng || null,
        accuracy: firstPoint.accuracy || null,
        pathPoints: points,
        faceVerified: status === 'present',
        gpsValidated: status === 'present',
        workingHours: status === 'present' ? (isLate ? 7.2 : 8.5) : 0,
        isLate,
        lateMinutes: isLate ? 18 : 0,
        tracking: {
          status: status === 'present' && offset === 0 ? 'ACTIVE' : 'STOPPED',
          startedAt: checkIn,
          stoppedAt: offset === 0 ? null : checkOut,
          lastHeartbeatAt: status === 'present' ? (offset === 0 ? new Date() : checkOut) : null,
          lastLocation: lastPoint
        },
        ruleEngineMeta: { demoSeedKey: DEMO_SEED_KEY }
      }, counters, 'attendance');
    }
  }

  for (const item of [
    { employee: employees[1], leaveType: 'PL', start: 3, end: 4, status: 'Pending', reason: 'Family function' },
    { employee: employees[2], leaveType: 'CL', start: -2, end: -2, status: 'Approved', reason: 'Personal work' },
    { employee: employees[4], leaveType: 'SL', start: 6, end: 6, status: 'Pending', reason: 'Medical appointment' }
  ]) {
    await upsertOne(LeaveRequest, { tenant, employee: item.employee._id, startDate: startOfDay(addDays(now, item.start)), leaveType: item.leaveType, 'meta.demoSeedKey': DEMO_SEED_KEY }, {
      tenant,
      employee: item.employee._id,
      leaveType: item.leaveType,
      startDate: startOfDay(addDays(now, item.start)),
      endDate: startOfDay(addDays(now, item.end)),
      reason: item.reason,
      status: item.status,
      appliedBy: 'Employee',
      daysCount: item.end - item.start + 1,
      paidLeaveDays: item.status === 'Approved' ? item.end - item.start + 1 : 0,
      unpaidLeaveDays: 0,
      approver: employees[0]?._id,
      approvedAt: item.status === 'Approved' ? addDays(now, -1) : undefined,
      meta: { demoSeedKey: DEMO_SEED_KEY }
    }, counters, 'leaveRequests');
  }

  const requirements = [];
  for (const [index, position] of positions.entries()) {
    const jobOpeningId = 'DEMO-JOB-' + String(index + 1).padStart(3, '0');
    requirements.push(await upsertOne(Requirement, { tenant, jobOpeningId }, {
      tenant,
      jobOpeningId,
      positionId: position._id,
      department: position.department,
      jobTitle: position.jobTitle,
      position: position.jobTitle,
      vacancy: 2 + index,
      status: 'Open',
      visibility: 'Both',
      hiringStatus: 'Open',
      approvalStatus: 'Approved',
      jobDetails: {
        salaryMin: position.baseSalaryRange?.min || 300000,
        salaryMax: position.baseSalaryRange?.max || 900000,
        experienceMin: index,
        experienceMax: index + 4,
        priority: index === 1 ? 'High' : 'Medium',
        visibility: 'Both',
        hiringManager: employees[0]?._id,
        interviewPanel: employees.slice(0, 3).map((entry) => entry._id),
        workMode: index === 2 ? 'Field' : 'On-site',
        jobType: 'Full-Time'
      },
      jobDescription: {
        roleOverview: 'Demo opening for ' + position.jobTitle + '.',
        responsibilities: ['Own daily delivery', 'Coordinate with stakeholders', 'Maintain weekly reporting'],
        keywords: ['HRMS', 'Demo', position.jobTitle],
        education: 'Bachelor degree preferred',
        certifications: []
      },
      requiredSkills: [{ name: index === 1 ? 'React' : 'Communication', weight: 40 }, { name: 'Ownership', weight: 30 }],
      preferredSkills: [{ name: 'HRMS experience', weight: 10 }],
      pipelineStages: [
        { stageId: 'applied', stageName: 'Applied', stageType: 'System', orderIndex: 1, isSystemStage: true },
        { stageId: 'screening', stageName: 'HR Screening', stageType: 'Screening', orderIndex: 2, assignedInterviewers: [employees[0]?._id].filter(Boolean) },
        { stageId: 'technical', stageName: 'Technical Interview', stageType: 'Technical', orderIndex: 3, assignedInterviewers: employees.slice(1, 3).map((entry) => entry._id) },
        { stageId: 'offer', stageName: 'Offer', stageType: 'Offer', orderIndex: 4 }
      ],
      candidateFlowTracking: { totalApplied: 4 + index, totalShortlisted: 2, totalInterviewed: 1, totalHired: index === 0 ? 1 : 0, totalRejected: 1 },
      meta: { demoSeedKey: DEMO_SEED_KEY }
    }, counters, 'requirements'));
  }

  for (const [index, candidate] of [
    ['Meera Iyer', 'Applied', 'APPLICATION'],
    ['Devansh Rao', 'Shortlisted', 'INTERVIEW'],
    ['Fatima Khan', 'Interview Scheduled', 'INTERVIEW'],
    ['Harsh Vyas', 'Selected', 'FINAL'],
    ['Riya Nair', 'Rejected', 'CLOSED']
  ].entries()) {
    const requirement = requirements[index % requirements.length];
    const email = candidate[0].toLowerCase().replace(/\s+/g, '.') + '@demo-candidate.local';
    await upsertOne(TrackerCandidate, { tenant, email }, {
      tenant,
      name: candidate[0],
      email,
      phone: '91000020' + index,
      requirementTitle: requirement.jobTitle,
      requirementId: requirement._id,
      requirement: requirement._id,
      currentStatus: candidate[1],
      currentStage: candidate[2],
      resume: '',
      remarks: 'Seeded demo candidate',
      meta: { demoSeedKey: DEMO_SEED_KEY }
    }, counters, 'trackerCandidates');
  }

  for (const [index, item] of [
    ['Laptop replacement request', 'Keyboard keys are not working properly.', 'IT', 'OPEN', 'HIGH'],
    ['Payslip clarification', 'Need clarification on professional tax deduction.', 'PAYROLL', 'IN_PROGRESS', 'MEDIUM'],
    ['ID card reprint', 'Employee ID card was damaged.', 'HR', 'DONE', 'LOW']
  ].entries()) {
    await upsertOne(Ticket, { tenant, employee: employees[index + 1]._id, title: item[0] }, {
      tenant,
      mainCompanyId: tenant,
      employee: employees[index + 1]._id,
      title: item[0],
      description: item[1],
      category: item[2],
      status: item[3],
      priority: item[4],
      assignedTo: employees[0]?._id,
      comments: [{
        sender: employees[index + 1].firstName + ' ' + employees[index + 1].lastName,
        senderId: employees[index + 1]._id,
        senderRole: 'employee',
        text: 'Demo ticket created for workflow testing.',
        createdAt: addDays(now, -index)
      }]
    }, counters, 'tickets');
  }

  // --- Seed Payroll Runs & Payslips ---
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthNum = prevMonthDate.getMonth() + 1;
  const prevMonthYear = prevMonthDate.getFullYear();

  const totalGrossRun = payslipRecords.reduce((acc, p) => acc + p.grossEarnings, 0);
  const totalDeductionsRun = payslipRecords.reduce((acc, p) => acc + p.preTaxDeductionsTotal, 0);
  const totalNetPayRun = payslipRecords.reduce((acc, p) => acc + p.netPay, 0);

  const payrollRun = await upsertOne(PayrollRun, { tenantId: tenant, month: prevMonthNum, year: prevMonthYear }, {
    tenantId: tenant,
    month: prevMonthNum,
    year: prevMonthYear,
    status: 'PAID',
    lifecycleState: 'PAID',
    periodKey: `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}`,
    runCode: `RUN-${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}`,
    runType: 'FULL',
    payPeriodStart: new Date(prevMonthYear, prevMonthNum - 1, 1),
    payPeriodEnd: new Date(prevMonthYear, prevMonthNum, 0),
    payDate: new Date(prevMonthYear, prevMonthNum, 5),
    initiatedBy: user?.id || user?._id || employees[0]?._id,
    calculatedBy: user?.id || user?._id || employees[0]?._id,
    approvedBy: user?.id || user?._id || employees[0]?._id,
    paidBy: user?.id || user?._id || employees[0]?._id,
    initiatedAt: new Date(prevMonthYear, prevMonthNum - 1, 28),
    calculatedAt: new Date(prevMonthYear, prevMonthNum - 1, 29),
    approvedAt: new Date(prevMonthYear, prevMonthNum - 1, 30),
    paidAt: new Date(prevMonthYear, prevMonthNum, 5),
    totalEmployees: employees.length,
    processedEmployees: employees.length,
    failedEmployees: 0,
    totalGross: totalGrossRun,
    totalDeductions: totalDeductionsRun,
    totalNetPay: totalNetPayRun,
    approvalStatus: 'APPROVED'
  }, counters, 'payrollRuns');

  for (const record of payslipRecords) {
    const payslipDoc = new Payslip({
      tenantId: tenant,
      employeeId: record.employeeId,
      payrollRunId: payrollRun._id,
      status: 'PAID',
      month: prevMonthNum,
      year: prevMonthYear,
      employeeInfo: record.employeeInfo,
      earningsSnapshot: record.earningsSnapshot,
      preTaxDeductionsSnapshot: record.preTaxDeductionsSnapshot,
      postTaxDeductionsSnapshot: record.postTaxDeductionsSnapshot,
      employerContributionsSnapshot: record.employerContributionsSnapshot,
      grossEarnings: record.grossEarnings,
      preTaxDeductionsTotal: record.preTaxDeductionsTotal,
      taxableIncome: record.taxableIncome,
      incomeTax: record.incomeTax,
      postTaxDeductionsTotal: record.postTaxDeductionsTotal,
      netPay: record.netPay,
      salaryTemplateId: record.salaryTemplateId,
      salaryTemplateSnapshot: record.salaryTemplateSnapshot,
      generatedBy: user?.id || user?._id || employees[0]?._id,
      generatedAt: new Date(prevMonthYear, prevMonthNum - 1, 29),
      approvedBy: user?.id || user?._id || employees[0]?._id,
      approvedAt: new Date(prevMonthYear, prevMonthNum - 1, 30),
      paidAt: new Date(prevMonthYear, prevMonthNum, 5)
    });
    payslipDoc.hash = payslipDoc.generateHash();

    const payslipObj = payslipDoc.toObject();
    delete payslipObj._id;

    await Payslip.findOneAndUpdate(
      { tenantId: tenant, payrollRunId: payrollRun._id, employeeId: record.employeeId },
      { $set: payslipObj, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    counters['payslips'] = counters['payslips'] || { created: 0, updated: 0 };
    counters['payslips'].created += 1;
  }

  // --- Seed active/initiated Payroll Run for the current month ---
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthYear = now.getFullYear();

  await upsertOne(PayrollRun, { tenantId: tenant, month: currentMonthNum, year: currentMonthYear }, {
    tenantId: tenant,
    month: currentMonthNum,
    year: currentMonthYear,
    status: 'INITIATED',
    lifecycleState: 'DRAFT',
    periodKey: `${currentMonthYear}-${String(currentMonthNum).padStart(2, '0')}`,
    runCode: `RUN-${currentMonthYear}-${String(currentMonthNum).padStart(2, '0')}`,
    runType: 'FULL',
    payPeriodStart: new Date(currentMonthYear, currentMonthNum - 1, 1),
    payPeriodEnd: new Date(currentMonthYear, currentMonthNum, 0),
    initiatedBy: user?.id || user?._id || employees[0]?._id,
    initiatedAt: new Date(),
    totalEmployees: employees.length,
    processedEmployees: 0,
    failedEmployees: 0,
    totalGross: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    approvalStatus: 'NOT_SUBMITTED'
  }, counters, 'payrollRuns');

  // --- Seed BGV Cases & Checks ---
  const suffix = String(tenantId).slice(-6).toUpperCase();
  const case1Id = `BGV-${suffix}-001`;
  const case2Id = `BGV-${suffix}-002`;

  const existingCases = await BGVCase.find({ tenant: tenant, caseId: { $in: [case1Id, case2Id] } }).select('_id').lean();
  const caseIds = existingCases.map(c => c._id);
  if (caseIds.length > 0) {
    await BGVCase.deleteMany({ _id: { $in: caseIds } });
    await BGVCheck.deleteMany({ caseId: { $in: caseIds } });
  }

  // Case 1: Completed & Verified for Aarav Shah
  const case1ObjectId = new mongoose.Types.ObjectId();
  const checks1 = [];
  for (const checkType of ['IDENTITY', 'EDUCATION', 'EMPLOYMENT']) {
    const chk = await upsertOne(BGVCheck, { tenant: tenant, caseId: case1ObjectId, type: checkType }, {
      caseId: case1ObjectId,
      tenant: tenant,
      type: checkType,
      status: 'VERIFIED',
      verificationWorkflow: {
        verifiedBy: user?.id || user?._id || null,
        verifiedAt: addDays(now, -11),
        verificationRemarks: `${checkType} check verified successfully.`,
        approvalDecision: 'APPROVED',
        approvedBy: user?.id || user?._id || null,
        approvedAt: addDays(now, -10),
        workflowStatus: 'COMPLETED',
        completedAt: addDays(now, -10)
      },
      mode: 'MANUAL',
      assignedTo: user?.id || user?._id || null,
      assignedAt: addDays(now, -15),
      startedAt: addDays(now, -14),
      completedAt: addDays(now, -10)
    }, counters, 'bgvChecks');
    checks1.push({ type: checkType, checkId: chk._id, status: 'VERIFIED' });
  }

  await upsertOne(BGVCase, { tenant: tenant, caseId: case1Id }, {
    _id: case1ObjectId,
    caseId: case1Id,
    tenant: tenant,
    employeeId: employees[0]._id,
    overallStatus: 'VERIFIED',
    overallResult: 'CLEAR',
    riskScore: 'LOW',
    decision: 'APPROVED',
    decisionBy: user?.id || user?._id || null,
    decisionAt: now,
    decisionRemarks: 'All checks verified and cleared.',
    initiatedBy: user?.id || user?._id || employees[0]?._id,
    initiatedAt: addDays(now, -15),
    completedAt: addDays(now, -10),
    isClosed: true,
    consentCaptured: true,
    consentCapturedAt: addDays(now, -15),
    checksRequested: checks1
  }, counters, 'bgvCases');

  // Case 2: In Progress for Priya Patel
  const case2ObjectId = new mongoose.Types.ObjectId();
  const checks2 = [];
  const chkIdentity = await upsertOne(BGVCheck, { tenant: tenant, caseId: case2ObjectId, type: 'IDENTITY' }, {
    caseId: case2ObjectId,
    tenant: tenant,
    type: 'IDENTITY',
    status: 'VERIFIED',
    verificationWorkflow: {
      verifiedBy: user?.id || user?._id || null,
      verifiedAt: addDays(now, -3),
      verificationRemarks: 'Identity check matches Aadhaar records.',
      approvalDecision: 'APPROVED',
      approvedBy: user?.id || user?._id || null,
      approvedAt: addDays(now, -2),
      workflowStatus: 'COMPLETED',
      completedAt: addDays(now, -2)
    },
    mode: 'API',
    assignedTo: user?.id || user?._id || null,
    assignedAt: addDays(now, -5),
    startedAt: addDays(now, -5),
    completedAt: addDays(now, -2)
  }, counters, 'bgvChecks');
  checks2.push({ type: 'IDENTITY', checkId: chkIdentity._id, status: 'VERIFIED' });

  const chkEducation = await upsertOne(BGVCheck, { tenant: tenant, caseId: case2ObjectId, type: 'EDUCATION' }, {
    caseId: case2ObjectId,
    tenant: tenant,
    type: 'EDUCATION',
    status: 'UNDER_VERIFICATION',
    verificationWorkflow: {
      workflowStatus: 'UNDER_VERIFICATION'
    },
    mode: 'MANUAL',
    assignedTo: user?.id || user?._id || null,
    assignedAt: addDays(now, -5),
    startedAt: addDays(now, -4)
  }, counters, 'bgvChecks');
  checks2.push({ type: 'EDUCATION', checkId: chkEducation._id, status: 'UNDER_VERIFICATION' });

  await upsertOne(BGVCase, { tenant: tenant, caseId: case2Id }, {
    _id: case2ObjectId,
    caseId: case2Id,
    tenant: tenant,
    employeeId: employees[1]._id,
    overallStatus: 'IN_PROGRESS',
    overallResult: 'PENDING',
    riskScore: 'LOW',
    decision: 'PENDING',
    initiatedBy: user?.id || user?._id || employees[0]?._id,
    initiatedAt: addDays(now, -5),
    isClosed: false,
    consentCaptured: true,
    consentCapturedAt: addDays(now, -5),
    checksRequested: checks2
  }, counters, 'bgvCases');

  // Run canonical payroll migration to populate EmployeeCtcVersion and EmployeePayrollProfile
  try {
    const migrationResult = await canonicalPayroll.migrateCanonicalPayrollData(tenantDB, tenant, {
      force: true,
      userId: user?.id || user?._id || null
    });
    counters['canonicalMigration'] = {
      created: (migrationResult.salaryVersionsCreated || 0) + (migrationResult.payrollProfilesCreated || 0),
      updated: 0
    };
  } catch (migError) {
    console.error('Error during canonical payroll migration in seeder:', migError);
  }

  return {
    seedKey: DEMO_SEED_KEY,
    defaultEmployeePassword: 'Demo@12345',
    summary: counters,
    demoEmployees: employees.map((employee) => ({
      employeeId: employee.employeeId,
      name: ((employee.firstName || '') + ' ' + (employee.lastName || '')).trim(),
      email: employee.email
    })),
    executedBy: user?.email || user?.id || null
  };
}

module.exports = { DEMO_SEED_KEY, seedDemoData };
