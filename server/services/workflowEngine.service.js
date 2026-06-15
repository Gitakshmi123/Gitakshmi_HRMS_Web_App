module.exports = {
  ...require('./workflowDefinition.service'),
  ...require('./workflowPublication.service'),
  ...require('./workflowDelegation.service'),
  ...require('./workflowQuery.service'),
  ...require('./workflowStart.service'),
  ...require('./workflowAction.service'),
};
