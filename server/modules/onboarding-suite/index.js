const { createOnboardingSuiteRouter } = require('./routes');
const { createOnboardingSuiteController } = require('./controller');
const { getOnboardingSuiteModels } = require('./models');
const { WorkflowEngine } = require('./workflow-engine.service');
const { DmsService } = require('./dms.service');
const { AttendanceFaceService } = require('./attendance-face.service');
const { NotificationService } = require('./notification.service');

module.exports = {
  createOnboardingSuiteRouter,
  createOnboardingSuiteController,
  getOnboardingSuiteModels,
  WorkflowEngine,
  DmsService,
  AttendanceFaceService,
  NotificationService,
};
