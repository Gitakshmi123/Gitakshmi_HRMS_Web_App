/**
 * seed_leave_balances.js
 * Seeds LeaveBalance records for all active employees in all tenants
 * based on their matched LeavePolicy.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URL;

async function seedLeaveBalances() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false, collection: 'companies' }));
  const tenants = await Tenant.find({ status: 'active' }).lean();
  console.log('Found tenants:', tenants.map(t => t.companyName));

  const { getTenantDB } = require('../config/dbManager');

  for (const tenant of tenants) {
    console.log(`\n=== Tenant: ${tenant.companyName} ===`);
    const tenantDB = await getTenantDB(tenant._id);

    const LeavePolicy = tenantDB.model('LeavePolicy');
    const Employee = tenantDB.model('Employee');
    const LeaveBalance = tenantDB.model('LeaveBalance');

    // Find all active policies with rules
    const policies = await LeavePolicy.find({ isActive: true }).lean();
    const policiesWithRules = policies.filter(p => Array.isArray(p.rules) && p.rules.length > 0);
    console.log(`  Active policies with rules: ${policiesWithRules.length}`);

    const employees = await Employee.find({ 
      $or: [{ status: 'Active' }, { status: 'active' }]
    }).lean();
    console.log(`  Active employees: ${employees.length}`);

    const year = new Date().getFullYear();
    let balancesCreated = 0;
    let employeesUpdated = 0;

    for (const emp of employees) {
      // Priority: assigned policy > All-scope policy > any policy
      let matchedPolicy = null;

      if (emp.leavePolicy) {
        matchedPolicy = policiesWithRules.find(p => String(p._id) === String(emp.leavePolicy));
      }

      if (!matchedPolicy) {
        // Find best matching policy (specific > department > All)
        matchedPolicy = policiesWithRules.find(p => p.applicableTo === 'Specific' && 
          Array.isArray(p.specificEmployeeIds) && p.specificEmployeeIds.some(id => String(id) === String(emp._id)));
      }

      if (!matchedPolicy) {
        matchedPolicy = policiesWithRules.find(p => p.applicableTo === 'All');
      }

      if (!matchedPolicy && policiesWithRules.length > 0) {
        matchedPolicy = policiesWithRules[0]; // fallback
      }

      if (!matchedPolicy) {
        console.log(`  [SKIP] No policy for emp: ${emp.employeeId || emp._id}`);
        continue;
      }

      // Assign policy to employee if not already set
      if (!emp.leavePolicy || String(emp.leavePolicy) !== String(matchedPolicy._id)) {
        await Employee.updateOne({ _id: emp._id }, { $set: { leavePolicy: matchedPolicy._id } });
        employeesUpdated++;
      }

      // Create missing LeaveBalance records
      for (const rule of matchedPolicy.rules) {
        const leaveType = String(rule.leaveType || '').trim().toUpperCase();
        if (!leaveType) continue;

        const exists = await LeaveBalance.findOne({ 
          tenant: tenant._id, 
          employee: emp._id, 
          leaveType, 
          year 
        }).lean();

        if (!exists) {
          const total = Number(rule.totalPerYear || 0);
          await LeaveBalance.create({
            tenant: tenant._id,
            employee: emp._id,
            policy: matchedPolicy._id,
            leaveType,
            year,
            total,
            opening: total,
            accrued: 0,
            used: 0,
            pending: 0,
            available: total,
            isOpeningManual: false
          });
          balancesCreated++;
          console.log(`  ✅ Created: emp=${emp.employeeId || String(emp._id).slice(-6)}, type=${leaveType}, total=${total}`);
        } else {
          console.log(`  ℹ  Exists: emp=${emp.employeeId || String(emp._id).slice(-6)}, type=${leaveType}, available=${exists.available}`);
        }
      }
    }

    console.log(`  Summary: ${employeesUpdated} employees linked to policy, ${balancesCreated} balances created.`);
  }

  console.log('\n✅ Seed complete!');
  process.exit(0);
}

seedLeaveBalances().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
