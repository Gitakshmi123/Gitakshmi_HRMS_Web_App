const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    const key = parts[0];
    const value = parts.slice(1).join('=');
    if (key && value) process.env[key.trim()] = value.trim();
  });
}

const mongoUri = process.env.MONGO_URI;
const getTenantDB = require('../utils/tenantDB');
const Tenant = require('../models/Tenant');

async function test() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');
  const tenant = await Tenant.findOne({ $or: [{ code: 'PNR' }, { companyName: 'PNR' }, { name: 'PNR' }] });
  console.log('Tenant:', tenant?._id, tenant?.companyName || tenant?.name);
  
  const db = await getTenantDB(tenant._id.toString());
  const Employee = db.model('Employee');
  
  const allEmployees = await Employee.find({ tenant: tenant._id })
    .select('firstName lastName employeeId role department departmentId email profilePic manager status designation')
    .populate('departmentId', 'name')
    .sort({ firstName: 1, lastName: 1 })
    .lean();
    
  console.log('Total employees in PNR:', allEmployees.length);
  
  // Normalize employee helper
  function normalizeOrgEmployee(emp) {
    return {
      _id: emp._id,
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      employeeId: emp.employeeId || '',
      role: emp.role || '',
      department: (emp.departmentId && emp.departmentId.name) || emp.department || 'General',
      departmentId: emp.departmentId ? (emp.departmentId._id || emp.departmentId) : null,
      email: emp.email || '',
      profilePic: emp.profilePic || null,
      status: emp.status || '',
      designation: emp.designation || emp.role || '',
      manager: emp.manager ? String(emp.manager) : null,
      subordinates: []
    };
  }
  
  const departmentEmployees = new Map();
  const employeeMap = new Map();

  allEmployees.forEach(emp => {
    const normalized = normalizeOrgEmployee(emp);
    employeeMap.set(String(emp._id), normalized);

    const deptName = normalized.department || 'General';
    if (!departmentEmployees.has(deptName)) {
      departmentEmployees.set(deptName, []);
    }
    departmentEmployees.get(deptName).push(normalized);
  });

  const departmentNodes = [];

  departmentEmployees.forEach((employeesInDept, deptName) => {
    const deptId = 'dept-' + deptName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const deptEmpMap = new Map();
    
    employeesInDept.forEach(emp => {
      deptEmpMap.set(String(emp._id), emp);
    });

    const deptRoots = [];

    employeesInDept.forEach(emp => {
      const managerId = emp.manager;
      if (managerId && deptEmpMap.has(String(managerId))) {
        const managerNode = deptEmpMap.get(String(managerId));
        managerNode.subordinates.push(emp);
      } else {
        deptRoots.push(emp);
      }
    });

    departmentNodes.push({
      _id: deptId,
      type: 'department',
      isDepartment: true,
      firstName: deptName,
      lastName: 'Department',
      role: 'Department',
      department: deptName,
      subordinates: deptRoots,
      isExpanded: true
    });
  });

  console.log('Generated department nodes:', departmentNodes.map(d => ({
    name: d.firstName,
    subordinatesCount: d.subordinates.length
  })));
  
  process.exit(0);
}

test();
