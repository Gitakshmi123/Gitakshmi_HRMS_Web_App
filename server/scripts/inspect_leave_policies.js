/**
 * inspect_leave_policies.js - inspect leave policies for all tenants
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URL;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected');

  const { getTenantDB } = require('../config/dbManager');
  const Tenant = mongoose.model('TenantInspect', new mongoose.Schema({}, { strict: false, collection: 'companies' }));
  const tenants = await Tenant.find({ status: 'active', companyName: { $in: ['PNR', 'Gitakshmi Technologies Private Limited'] } }).lean();

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.companyName} (${tenant._id}) ===`);
    const tenantDB = await getTenantDB(tenant._id);
    const LeavePolicy = tenantDB.model('LeavePolicy');
    const Employee = tenantDB.model('Employee');
    const LeaveBalance = tenantDB.model('LeaveBalance');

    const policies = await LeavePolicy.find({}).lean();
    console.log(`Policies (${policies.length}):`);
    for (const p of policies) {
      console.log(`  - "${p.name}" | isActive=${p.isActive} | applicableTo=${p.applicableTo} | rules=${p.rules?.length || 0} | formulas=${p.formulas?.length || 0} | leaveTypes=${JSON.stringify(p.leaveTypes)}`);
      if (p.rules?.length > 0) {
        p.rules.forEach(r => console.log(`      rule: leaveType="${r.leaveType}" totalPerYear=${r.totalPerYear}`));
      }
    }

    const employees = await Employee.find({}).lean();
    console.log(`Employees (${employees.length}):`);
    for (const emp of employees) {
      const balances = await LeaveBalance.find({ employee: emp._id, year: 2026 }).lean();
      console.log(`  - ${emp.firstName} ${emp.lastName} (${emp.employeeId}) | leavePolicy=${emp.leavePolicy || 'NONE'} | balances=${balances.length}`);
      balances.forEach(b => console.log(`      balance: type=${b.leaveType} total=${b.total} available=${b.available}`));
    }
  }

  process.exit(0);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
