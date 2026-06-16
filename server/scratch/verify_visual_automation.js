const mongoose = require('mongoose');
const path = require('path');

// Load env configuration
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0';

async function run() {
  try {
    console.log('Connecting to master hrms database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to master DB!');

    // 1. Resolve tenant document for 'pnr' code
    const Tenant = require('../models/Tenant');
    const tenantDoc = await Tenant.findOne({ 
      $or: [
        { code: 'pnr' }, 
        { code: 'pnr001' },
        { databaseName: 'company_pnr' }
      ] 
    }).lean();

    if (!tenantDoc) {
      console.error('❌ FAIL: Tenant "pnr" or database "company_pnr" was not found in the hrms master catalog!');
      process.exit(1);
    }
    const tenantId = tenantDoc._id;
    console.log(`Resolved Tenant PNR: Name: ${tenantDoc.companyName} | ID: ${tenantId} | DB: ${tenantDoc.databaseName}`);

    // 2. Load tenant database connection
    const getTenantDB = require('../utils/tenantDB');
    const tenantDB = await getTenantDB(tenantId);
    console.log(`Connected to tenant database: ${tenantDB.name}`);

    // 3. Register all schemas on tenantDB so getWorkflowModels works
    const AutomationSchema = require('../models/Automation');
    const WorkflowSchema = require('../models/Workflow');
    const WorkflowVersionSchema = require('../models/WorkflowVersion');
    const WorkflowInstanceSchema = require('../models/WorkflowInstance');
    const WorkflowAssignmentSchema = require('../models/WorkflowAssignment');
    const EmployeeSchema = require('../models/Employee');
    const UserSchema = require('../models/User');
    const LeaveRequestSchema = require('../models/LeaveRequest');
    const LeaveBalanceSchema = require('../models/LeaveBalance');
    const NotificationSchema = require('../models/Notification');
    const EmployeeHierarchySchema = require('../models/EmployeeHierarchy');
    const WorkflowHistorySchema = require('../models/WorkflowHistory');
    const WorkflowDelegationSchema = require('../models/WorkflowDelegation');

    const registerOnTenant = (name, schema) => {
      if (!tenantDB.models[name]) {
        tenantDB.model(name, schema);
      }
      return tenantDB.model(name);
    };

    const Automation = registerOnTenant('Automation', AutomationSchema);
    const Workflow = registerOnTenant('Workflow', WorkflowSchema);
    const WorkflowVersion = registerOnTenant('WorkflowVersion', WorkflowVersionSchema);
    const WorkflowInstance = registerOnTenant('WorkflowInstance', WorkflowInstanceSchema);
    const WorkflowAssignment = registerOnTenant('WorkflowAssignment', WorkflowAssignmentSchema);
    const Employee = registerOnTenant('Employee', EmployeeSchema);
    const User = registerOnTenant('User', UserSchema);
    const LeaveRequest = registerOnTenant('LeaveRequest', LeaveRequestSchema);
    const LeaveBalance = registerOnTenant('LeaveBalance', LeaveBalanceSchema);
    registerOnTenant('Notification', NotificationSchema);
    registerOnTenant('EmployeeHierarchy', EmployeeHierarchySchema);
    registerOnTenant('WorkflowHistory', WorkflowHistorySchema);
    registerOnTenant('WorkflowDelegation', WorkflowDelegationSchema);

    // 4. Fetch any active employee to act as requester
    const emp = await Employee.findOne({ isDeleted: { $ne: true } }).lean();
    if (!emp) {
      console.error('No employee found in database! Please register an employee first.');
      process.exit(1);
    }
    console.log(`Using Employee: ${emp.firstName} ${emp.lastName} (ID: ${emp._id})`);

    // Ensure employee has a manager or mock TL/Manager for hierarchy resolver testing
    // If not, we will set a mock manager to ensure 'reporting_manager_approval' step succeeds
    let managerEmployee = null;
    if (!emp.manager) {
      console.log('Requester employee does not have a manager. Looking for fallback manager employee...');
      managerEmployee = await Employee.findOne({ _id: { $ne: emp._id }, isDeleted: { $ne: true } }).lean();
      if (managerEmployee) {
        console.log(`Temporarily linking reporting manager to: ${managerEmployee.firstName} ${managerEmployee.lastName} (ID: ${managerEmployee._id})`);
        await Employee.findByIdAndUpdate(emp._id, { $set: { manager: managerEmployee._id } });
      }
    }

    // 5. Fetch or create published workflow definition
    let workflow = await Workflow.findOne({ tenantId, moduleKey: 'leave', entityType: 'LeaveRequest', isActive: true });
    if (!workflow) {
      console.log('No active workflow found. Creating standard leave workflow...');
      workflow = await Workflow.create({
        tenantId,
        moduleKey: 'leave',
        entityType: 'LeaveRequest',
        name: 'Leave Approval Workflow',
        description: 'Automatic leave request approval path',
        isGlobal: true,
        isActive: true,
        status: 'PUBLISHED'
      });
    }

    let version = await WorkflowVersion.findOne({ workflowId: workflow._id, status: 'PUBLISHED' });
    if (!version) {
      console.log('Creating published workflow version...');
      version = await WorkflowVersion.create({
        tenantId,
        workflowId: workflow._id,
        version: 1,
        status: 'PUBLISHED',
        definition: {
          steps: [
            {
              key: 'reporting_manager_approval',
              name: 'Reporting Manager Approval',
              order: 1,
              approvalMode: 'ANY',
              minApprovals: 1,
              slaHours: 24,
              approver: {
                type: 'REPORTING_MANAGER',
                value: null
              }
            }
          ]
        }
      });
      workflow.activeVersionId = version._id;
      workflow.activeVersion = 1;
      await workflow.save();
    }
    console.log(`Active workflow version resolves: ${version._id}`);

    // 6. Create custom automation rule for LEAVE_REQUESTED
    console.log('Cleaning up existing verify automations...');
    await Automation.deleteMany({ name: 'Verify Leave Rule' });

    console.log('Creating custom automation rule...');
    const automationRule = await Automation.create({
      tenantId,
      name: 'Verify Leave Rule',
      description: 'Triggered automatically when a leave is applied',
      triggerEvent: 'LEAVE_REQUESTED',
      isActive: true,
      conditions: [],
      actions: [
        {
          type: 'TRIGGER_APPROVAL',
          config: {
            moduleKey: 'leave',
            entityType: 'LeaveRequest',
            requesterEmployeeField: 'employeeId',
            workflowName: 'Verify Leave Approval Automation',
            approvalSteps: [
              {
                key: 'reporting_manager_approval',
                name: 'Reporting Manager Approval',
                approverType: 'REPORTING_MANAGER',
                approverValue: 'REPORTING_MANAGER',
                approvalMode: 'ANY',
                minApprovals: 1,
                slaHours: 24,
                emailTriggerType: '',
                emailToField: 'assignee.email'
              }
            ]
          },
          order: 1
        }
      ],
      visualLayout: {
        nodes: [
          { id: '1', type: 'trigger', data: { event: 'LEAVE_REQUESTED' } },
          { id: '2', type: 'action', data: { type: 'TRIGGER_APPROVAL' } }
        ]
      }
    });
    console.log('Automation rule created:', automationRule._id);

    // 7. Create a test LeaveRequest directly in tenantDB
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 12);

    const leaveRequest = await LeaveRequest.create({
      tenant: tenantId,
      employee: emp._id,
      leaveType: 'Sick',
      startDate,
      endDate,
      reason: 'Automated test verification',
      daysCount: 3,
      status: 'Pending',
      appliedBy: 'Employee'
    });
    console.log('Test LeaveRequest created:', leaveRequest._id);

    // 8. Simulate triggering of LEAVE_REQUESTED event
    const { dispatchEvent } = require('../services/automationEngine.service');
    console.log('Dispatching LEAVE_REQUESTED event to automation engine...');
    await dispatchEvent(tenantId, 'LEAVE_REQUESTED', {
      ...leaveRequest.toObject(),
      employeeId: emp._id
    });

    // Wait a brief moment for background actions to resolve
    console.log('Waiting for background workflow execution (3 seconds)...');
    await new Promise(r => setTimeout(r, 3000));

    // 9. Verify if WorkflowInstance and Assignments were created
    const instance = await WorkflowInstance.findOne({ tenantId, entityId: leaveRequest._id });
    if (instance) {
      console.log('✅ SUCCESS: WorkflowInstance was created successfully!');
      console.log(`  Instance ID: ${instance._id}`);
      console.log(`  Status: ${instance.status} (Final Error: ${instance.finalActionError || 'None'})`);
      
      const assignments = await WorkflowAssignment.find({ instanceId: instance._id });
      console.log(`  Assignments created: ${assignments.length}`);
      assignments.forEach(a => {
        console.log(`    - Step: ${a.stepName} | Assignee Employee: ${a.assigneeEmployeeId} | Status: ${a.status}`);
      });

      const updatedLeave = await LeaveRequest.findById(leaveRequest._id);
      console.log(`  Updated LeaveRequest meta workflowInstanceId:`, updatedLeave.meta?.workflowInstanceId);
      if (updatedLeave.meta?.workflowInstanceId && String(updatedLeave.meta.workflowInstanceId) === String(instance._id)) {
        console.log('✅ SUCCESS: LeaveRequest correctly linked to workflowInstanceId!');
      } else {
        console.error('❌ FAIL: LeaveRequest failed to link to workflowInstanceId.');
      }

      // Cleanup instance history/assignments
      await WorkflowAssignment.deleteMany({ instanceId: instance._id });
      await WorkflowInstance.deleteOne({ _id: instance._id });
    } else {
      console.error('❌ FAIL: No WorkflowInstance was found for this leave request!');
    }

    // 10. Cleanup test data
    console.log('Cleaning up mock data...');
    await LeaveRequest.deleteOne({ _id: leaveRequest._id });
    await Automation.deleteOne({ _id: automationRule._id });
    const generatedWorkflows = await Workflow.find({ name: 'Verify Leave Approval Automation' }).select('_id').lean();
    const generatedWorkflowIds = generatedWorkflows.map((item) => item._id);
    if (generatedWorkflowIds.length) {
      await WorkflowVersion.deleteMany({ workflowId: { $in: generatedWorkflowIds } });
      await Workflow.deleteMany({ _id: { $in: generatedWorkflowIds } });
    }
    if (managerEmployee) {
      console.log('Reverting temporary employee manager link...');
      await Employee.findByIdAndUpdate(emp._id, { $unset: { manager: "" } });
    }
    console.log('Cleanup complete.');

    // Close connections
    await mongoose.connection.close();
    await tenantDB.close();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('An error occurred during verification:', err);
    process.exit(1);
  }
}

run();
