const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    console.log('Connecting to database:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // In a multi-tenant setup, let's list the tenant companies first
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const tenants = await Tenant.find({}).lean();
    console.log(`Found ${tenants.length} tenants:`);
    tenants.forEach(t => {
      console.log(`- ID: ${t._id}, Name: ${t.companyName || t.name}, Domain: ${t.domain}`);
    });

    const EmailTemplate = mongoose.model('EmailTemplate', require('../models/EmailTemplate'));
    const templates = await EmailTemplate.find({}).lean();
    console.log(`\nFound ${templates.length} email templates in total:`);
    templates.forEach(t => {
      console.log(`- ID: ${t._id}, TenantID: ${t.tenantId}, Name: ${t.name}, Trigger: ${t.triggerType}, Active: ${t.isActive}`);
    });

    // Also let's inspect the latest workflow assignments to see what stepName they are using
    const WorkflowAssignmentSchema = new mongoose.Schema({}, { strict: false });
    const WorkflowAssignment = mongoose.model('WorkflowAssignment', WorkflowAssignmentSchema);
    const latestAssignments = await WorkflowAssignment.find({}).sort({ createdAt: -1 }).limit(5).lean();
    console.log(`\nLatest 5 workflow assignments:`);
    latestAssignments.forEach(a => {
      console.log(`- ID: ${a._id}, TenantID: ${a.tenantId}, StepKey: ${a.stepKey}, StepName: ${a.stepName}, Email: ${a.assigneeEmail}, Status: ${a.status}, CreatedAt: ${a.createdAt}`);
    });

    mongoose.disconnect();
  } catch (err) {
    console.error('Error running diagnostic:', err);
  }
}

run();
