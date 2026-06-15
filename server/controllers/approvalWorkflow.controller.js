const getTenantDB = require('../utils/tenantDB');

exports.getWorkflows = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const Workflow = tenantDB.model('ApprovalWorkflow');

    const workflows = await Workflow.find({ tenantId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: workflows
    });
  } catch (error) {
    next(error);
  }
};

exports.getWorkflow = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const Workflow = tenantDB.model('ApprovalWorkflow');

    const workflow = await Workflow.findOne({ _id: req.params.id, tenantId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    res.status(200).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    next(error);
  }
};

exports.createWorkflow = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const Workflow = tenantDB.model('ApprovalWorkflow');

    const { name, entityType, steps, isActive } = req.body;

    const newWorkflow = new Workflow({
      tenantId,
      name,
      entityType,
      steps,
      isActive
    });

    await newWorkflow.save();

    res.status(201).json({
      success: true,
      data: newWorkflow
    });
  } catch (error) {
    next(error);
  }
};

exports.updateWorkflow = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const Workflow = tenantDB.model('ApprovalWorkflow');

    const { name, entityType, steps, isActive } = req.body;

    const workflow = await Workflow.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { name, entityType, steps, isActive },
      { new: true, runValidators: true }
    );

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    res.status(200).json({
      success: true,
      data: workflow
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteWorkflow = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const Workflow = tenantDB.model('ApprovalWorkflow');

    const workflow = await Workflow.findOneAndDelete({ _id: req.params.id, tenantId });

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
