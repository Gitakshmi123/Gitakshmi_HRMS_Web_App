const { finalizeLeaveWorkflow } = require('./workflowAdapters/leaveWorkflow.adapter');
const { finalizeLetterWorkflow } = require('./workflowAdapters/letterWorkflow.adapter');

async function finalizeWorkflowEntity(payload) {
  if (payload.moduleKey === 'leave' && payload.entityType === 'LeaveRequest') {
    return finalizeLeaveWorkflow(payload);
  }

  if ((payload.moduleKey === 'recruitment' || payload.moduleKey === 'letter') && payload.entityType === 'GeneratedLetter') {
    return finalizeLetterWorkflow(payload);
  }

  return null;
}

module.exports = {
  finalizeWorkflowEntity,
};
