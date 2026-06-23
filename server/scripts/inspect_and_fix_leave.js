/**
 * inspect_and_fix_leave.js
 * Uses the exact same getTenantDB mechanism as the running server
 * to inspect and fix leave policies and balances.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URL;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI.replace(/:\/\/[^@]+@/, '://***@'));

  const { getTenantDB } = require('../config/dbManager');

  // List all DBs on this MongoDB instance
  const admin = mongoose.connection.db.admin();
  const dbList = await admin.listDatabases();
  const companyDbs = dbList.databases.filter(d => d.name.startsWith('company_'));
  console.log(`\nFound ${companyDbs.length} company databases:`);
  companyDbs.forEach(d => console.log(`  - ${d.name} (${d.sizeOnDisk} bytes)`));

  // For each company DB, check policies and employees
  for (const dbInfo of companyDbs) {
    const dbName = dbInfo.name;
    console.log(`\n=== Database: ${dbName} ===`);

    // Use useDb directly
    const tenantDB = mongoose.connection.useDb(dbName, { useCache: true });

    // Register models manually for this inspection
    const LeavePolicySchema = require('../models/LeavePolicy');
    const EmployeeSchema = require('../models/Employee');
    const LeaveBalanceSchema = require('../models/LeaveBalance');

    const LeavePolicy = tenantDB.models.LeavePolicy || tenantDB.model('LeavePolicy', LeavePolicySchema.schema || LeavePolicySchema);
    const Employee = tenantDB.models.Employee || tenantDB.model('Employee', EmployeeSchema.schema || EmployeeSchema);
    const LeaveBalance = tenantDB.models.LeaveBalance || tenantDB.model('LeaveBalance', LeaveBalanceSchema.schema || LeaveBalanceSchema);

    const policies = await LeavePolicy.find({}).lean();
    console.log(`\nPolicies: ${policies.length}`);
    for (const p of policies) {
      console.log(`  - "${p.name}" | isActive=${p.isActive} | applicableTo=${p.applicableTo} | rules=${p.rules?.length || 0}`);
      if (p.rules?.length > 0) {
        p.rules.forEach(r => console.log(`      rule: "${r.leaveType}" totalPerYear=${r.totalPerYear}`));
      }
    }

    const employees = await Employee.find({}).lean();
    console.log(`\nEmployees: ${employees.length}`);
    for (const emp of employees) {
      const balances = await LeaveBalance.find({ employee: emp._id, year: new Date().getFullYear() }).lean();
      console.log(`  - ${emp.firstName || ''} ${emp.lastName || ''} (${emp.employeeId || emp._id}) | leavePolicy=${emp.leavePolicy || 'NONE'} | balances2026=${balances.length}`);
      balances.forEach(b => console.log(`      [BALANCE] type=${b.leaveType} total=${b.total} available=${b.available}`));
    }

    // Fix: assign policy and seed balances
    if (policies.length > 0 && employees.length > 0) {
      const year = new Date().getFullYear();
      let fixed = 0;

      // Find best "All" policy
      const allPolicy = policies.find(p => p.isActive && p.applicableTo === 'All' && p.rules?.length > 0);
      const anyActivePolicy = policies.find(p => p.isActive && p.rules?.length > 0);
      const targetPolicy = allPolicy || anyActivePolicy;

      if (!targetPolicy) {
        console.log('  No active policy with rules found. Skipping fix.');
        continue;
      }

      console.log(`\n  Applying policy "${targetPolicy.name}" to employees...`);

      for (const emp of employees) {
        // Get tenant ID from an employee or use DB name
        const tenantId = emp.tenant || emp.mainCompanyId;

        // Link policy to employee if needed
        const needsPolicyLink = !emp.leavePolicy || String(emp.leavePolicy) !== String(targetPolicy._id);
        if (needsPolicyLink) {
          await Employee.updateOne({ _id: emp._id }, { $set: { leavePolicy: targetPolicy._id } });
          console.log(`  ✅ Linked policy to ${emp.firstName} ${emp.lastName}`);
        }

        // Create missing balance records
        for (const rule of targetPolicy.rules) {
          const leaveType = String(rule.leaveType || '').trim().toUpperCase();
          if (!leaveType || !tenantId) continue;

          const exists = await LeaveBalance.findOne({
            employee: emp._id,
            leaveType,
            year
          }).lean();

          if (!exists) {
            const total = Number(rule.totalPerYear || 0);
            await LeaveBalance.create({
              tenant: tenantId,
              employee: emp._id,
              policy: targetPolicy._id,
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
            console.log(`  ✅ Created balance: ${emp.firstName} ${emp.lastName} | ${leaveType} = ${total} days`);
            fixed++;
          } else {
            console.log(`  ℹ  Balance exists: ${emp.firstName} ${emp.lastName} | ${leaveType} = available:${exists.available}`);
          }
        }
      }
      console.log(`\n  Fix complete. Created ${fixed} new balance records.`);
    }
  }

  console.log('\n✅ All done!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message, err.stack);
  process.exit(1);
});
