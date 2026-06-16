const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables
let envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, '../../.env');
}

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    const key = parts[0];
    const value = parts.slice(1).join('=');
    if (key && value) process.env[key.trim()] = value.trim();
  });
}

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gt_hrms';

// Import tenantDB helper
const getTenantDB = require('../utils/tenantDB');
const Tenant = require('../models/Tenant');

async function heal() {
  try {
    console.log('Connecting to Main Database:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected successfully to Main Database.');

    const tenants = await Tenant.find({ status: { $ne: 'deleted' } }).lean();
    console.log(`Found ${tenants.length} active tenant(s). Starting database healing...`);

    for (const tenant of tenants) {
      const tenantIdStr = tenant._id.toString();
      const companyName = tenant.companyName || tenant.name || 'Unknown Company';
      console.log(`\n----------------------------------------`);
      console.log(`Processing Tenant: ${companyName} (${tenantIdStr})`);

      let db;
      try {
        db = await getTenantDB(tenantIdStr);
        if (!db) {
          console.warn(`Could not resolve database connection for tenant ${tenantIdStr}. Skipping.`);
          continue;
        }
      } catch (dbErr) {
        console.error(`Database connection failed for tenant ${tenantIdStr}:`, dbErr.message);
        continue;
      }

      // Fetch all departments for this tenant
      const Department = db.model('Department');
      const Employee = db.model('Employee');

      const departments = await Department.find({ mainCompanyId: tenant._id }).lean();
      console.log(`Found ${departments.length} department(s) registered for this tenant.`);

      // Build department lookup map
      const deptMap = {};
      departments.forEach(d => {
        if (d.name) {
          deptMap[d.name.toLowerCase().trim()] = d._id;
        }
      });

      // Find employees with null/missing departmentId but who have a department name string
      const employeesToHeal = await Employee.find({
        tenant: tenant._id,
        $or: [
          { departmentId: null },
          { departmentId: { $exists: false } }
        ],
        department: { $exists: true, $ne: '' }
      });

      console.log(`Found ${employeesToHeal.length} employee(s) with missing departmentId.`);

      let healedCount = 0;
      let unresolvedCount = 0;

      for (const emp of employeesToHeal) {
        const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId || 'Unnamed Employee';
        const empDeptStr = String(emp.department || '').trim();
        const normalizedDept = empDeptStr.toLowerCase();

        if (deptMap[normalizedDept]) {
          const matchedDeptId = deptMap[normalizedDept];
          emp.departmentId = matchedDeptId;
          await emp.save();
          console.log(`  [HEALED] Link resolved: Employee "${empName}" (${emp.employeeId}) -> Department "${empDeptStr}" (${matchedDeptId})`);
          healedCount++;
        } else {
          // If department doesn't exist, try to auto-create it to heal the relationship fully
          try {
            let deptCode = empDeptStr
              .toUpperCase()
              .replace(/[^A-Z0-9\s]/g, '')
              .split(/\s+/)
              .map(word => word[0])
              .join('');
            
            if (!deptCode || deptCode.length < 2) {
              deptCode = empDeptStr.slice(0, 3).toUpperCase();
            }

            const existingDeptWithCode = await Department.findOne({
              mainCompanyId: tenant._id,
              code: deptCode
            });
            if (existingDeptWithCode) {
              deptCode = `${deptCode}${Math.floor(10 + Math.random() * 90)}`;
            }

            console.log(`  [CREATING] Creating missing department "${empDeptStr}" with code "${deptCode}"...`);
            const newDept = await Department.create({
              name: empDeptStr,
              code: deptCode,
              mainCompanyId: tenant._id,
              isActive: true
            });

            // Add to map for subsequent employees in same loop
            deptMap[normalizedDept] = newDept._id;
            
            emp.departmentId = newDept._id;
            await emp.save();
            console.log(`  [HEALED] Link resolved (newly created): Employee "${empName}" (${emp.employeeId}) -> Department "${empDeptStr}" (${newDept._id})`);
            healedCount++;
          } catch (createErr) {
            console.warn(`  [UNRESOLVED] No department match for "${empDeptStr}" (Employee: ${empName}) and failed to create: ${createErr.message}`);
            unresolvedCount++;
          }
        }
      }

      console.log(`Finished Tenant processing: ${healedCount} healed, ${unresolvedCount} unresolved.`);
    }

    console.log('\n----------------------------------------');
    console.log('Database healing process completed successfully.');
    process.exit(0);

  } catch (err) {
    console.error('Fatal error during database healing:', err);
    process.exit(1);
  }
}

heal();
