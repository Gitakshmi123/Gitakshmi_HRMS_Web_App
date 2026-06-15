/*
  Test: ensureLeavePolicy + apply flow
  Run: node scripts/test_apply_auto_policy.js

  This script will:
   - Connect to main DB
   - Pick the first tenant
   - Create an Employee WITHOUT leavePolicy
   - Run ensureLeavePolicy and report results
   - Attempt to create a LeaveRequest for that employee
*/

const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('../utils/tenantDB');
const { getTenantDB: dummy } = require('../config/dbManager'); // for logging

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('MONGO_URI missing in .env');
    process.exit(1);
}

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to main DB');

    const Tenant = require('../models/Tenant');
    const tenants = await Tenant.find({}).limit(1);
    if (!tenants || tenants.length === 0) {
        console.error('No tenants found in DB');
        process.exit(1);
    }

    const tenant = tenants[0];
    console.log('Using tenant:', tenant.name, tenant._id.toString());

    const tenantDb = await getTenantDB(tenant._id);
    const Employee = tenantDb.model('Employee');
    const LeavePolicy = tenantDb.model('LeavePolicy');
    const LeaveRequest = tenantDb.model('LeaveRequest');

    // Create employee with minimal data and no leavePolicy
    const emp = new Employee({
        firstName: 'AutoTest',
        lastName: 'Policy',
        tenant: tenant._id,
        status: 'Active'
    });
    await emp.save();
    console.log('Created test employee:', emp._id.toString());

    const { ensureLeavePolicy } = require('../config/dbManager');

    console.log('Calling ensureLeavePolicy...');
    const updated = await ensureLeavePolicy(emp, tenantDb, tenant._id.toString());

    console.log('Resulting leavePolicy:', updated.leavePolicy ? updated.leavePolicy : 'NONE');

    // Try to apply leave as employee
    try {
        const leave = await LeaveRequest.create({
            tenant: tenant._id,
            employee: updated._id,
            leaveType: 'Casual Leave',
            startDate: new Date(),
            endDate: new Date(),
            reason: 'Test auto policy assign',
            status: 'Pending'
        });
        console.log('Leave request created:', leave._id.toString());
    } catch (err) {
        console.error('Failed to create leave request:', err.message);
    }

    console.log('Test script done. Cleanup is recommended (remove test employee & requests).');
    process.exit(0);
}

run().catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
});