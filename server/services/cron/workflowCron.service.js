const mongoose = require('mongoose');
const { getWorkflowModels } = require('../workflowRuntimeCore.service');
const emailService = require('../email.service');

async function processEscalations() {
  console.log('[WorkflowCron] Starting SLA Escalation check...');
  
  // Since this is multi-tenant, we should find pending assignments across all tenants.
  // We'll iterate through them.
  const models = mongoose.models;
  const WorkflowAssignment = models.WorkflowAssignment;
  const WorkflowInstance = models.WorkflowInstance;
  const Employee = models.Employee;
  
  if (!WorkflowAssignment || !WorkflowInstance || !Employee) {
    console.log('[WorkflowCron] Models not ready.');
    return;
  }

  const now = new Date();
  
  try {
    // 1. Reminders: Assignments due within the next 2 hours but not yet reminded
    const pendingReminders = await WorkflowAssignment.find({
      status: 'PENDING',
      dueAt: { $lte: new Date(now.getTime() + 2 * 60 * 60 * 1000), $gt: now },
      remindedAt: { $exists: false }
    }).populate('assigneeEmployeeId');

    for (const assignment of pendingReminders) {
      if (assignment.assigneeEmployeeId && assignment.assigneeEmployeeId.email) {
        // Send email reminder
        // await emailService.sendWorkflowReminder(assignment.assigneeEmployeeId.email, ...);
        assignment.remindedAt = now;
        await assignment.save();
        console.log(`[WorkflowCron] Sent reminder for assignment ${assignment._id}`);
      }
    }

    // 2. Escalations: Assignments that have breached their SLA
    const breachedAssignments = await WorkflowAssignment.find({
      status: 'PENDING',
      dueAt: { $lte: now },
      escalatedAt: { $exists: false }
    });

    for (const assignment of breachedAssignments) {
      const instance = await WorkflowInstance.findById(assignment.instanceId);
      if (!instance || instance.status !== 'PENDING') continue;

      console.log(`[WorkflowCron] Escalating assignment ${assignment._id}`);
      
      // We will escalate to the manager of the assignee.
      const assignee = await Employee.findById(assignment.assigneeEmployeeId).lean();
      
      if (assignee && assignee.manager) {
        // Reassign to the manager
        assignment.status = 'ESCALATED';
        assignment.escalatedAt = now;
        await assignment.save();
        
        // Create new assignment for manager
        await WorkflowAssignment.create({
          tenantId: assignment.tenantId,
          instanceId: assignment.instanceId,
          workflowId: assignment.workflowId,
          workflowVersionId: assignment.workflowVersionId,
          stepKey: assignment.stepKey,
          stepName: assignment.stepName + ' (Escalated)',
          stepOrder: assignment.stepOrder,
          assigneeEmployeeId: assignee.manager,
          assigneeUserId: null, // Resolving user logic omitted for brevity
          dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Give 24 hours
        });
        
        // Also log the escalation
        const WorkflowEscalation = models.WorkflowEscalation || mongoose.model('WorkflowEscalation');
        await WorkflowEscalation.create({
          tenantId: assignment.tenantId,
          instanceId: assignment.instanceId,
          assignmentId: assignment._id,
          level: 1,
          action: 'ESCALATE_TO_MANAGER',
          status: 'PROCESSED',
          scheduledAt: now,
          processedAt: now,
        });
      } else {
        // If no manager, maybe send to HR or Admin
        assignment.escalatedAt = now;
        await assignment.save();
      }
    }
    
    console.log('[WorkflowCron] Completed SLA Escalation check.');
  } catch (error) {
    console.error('[WorkflowCron] Error in escalations:', error);
  }
}

module.exports = {
  processEscalations
};
