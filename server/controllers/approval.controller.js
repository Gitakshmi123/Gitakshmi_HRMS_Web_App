const getTenantDB = require('../utils/tenantDB');
const ApprovalService = require('../services/approval.service');
const { Types } = require('mongoose');

exports.getPendingApprovals = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const ApprovalModel = tenantDB.model('Approval');
    
    // Using populate for entity and requester
    const approvals = await ApprovalModel.find({
      tenantId,
      currentApprovers: req.user.id,
      status: 'PENDING_APPROVAL'
    })
    .populate('requesterId', 'firstName lastName email profilePhoto')
    .sort({ createdAt: -1 });
    
    // We ideally want to populate the actual entity too, which is polymorphic.
    // For now we return raw entityId, UI will fetch if needed or we manually resolve.
    const result = [];
    for (const app of approvals) {
       let entity = null;
       try {
           const EntityModel = tenantDB.model(app.entityModel);
           entity = await EntityModel.findById(app.entityId).lean();
       } catch(e) {}
       result.push({
           ...app.toObject(),
           entity
       });
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getApprovalHistory = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const ApprovalLogModel = tenantDB.model('ApprovalLog');
    
    const logs = await ApprovalLogModel.find({
      actionBy: req.user.id
    })
    .populate({
        path: 'approvalId',
        populate: {
            path: 'requesterId',
            select: 'firstName lastName email'
        }
    })
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

exports.getApprovalDetails = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantDB = await getTenantDB(tenantId);
    const ApprovalModel = tenantDB.model('Approval');
    const ApprovalLogModel = tenantDB.model('ApprovalLog');

    const approval = await ApprovalModel.findById(req.params.id)
      .populate('requesterId', 'firstName lastName email');
      
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }

    const logs = await ApprovalLogModel.find({ approvalId: approval._id })
      .populate('actionBy', 'firstName lastName email profilePhoto')
      .sort({ createdAt: 1 });

    let entity = null;
    try {
        const EntityModel = tenantDB.model(approval.entityModel);
        entity = await EntityModel.findById(approval.entityId).lean();
    } catch(e) {}

    res.status(200).json({
      success: true,
      data: {
        ...approval.toObject(),
        entity,
        timeline: logs
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.processAction = async (req, res, next) => {
  try {
    const { action, comments } = req.body; // action: APPROVED, REJECTED, REQUESTED_CHANGES
    
    const approval = await ApprovalService.processAction(
        req.user.tenantId, 
        req.params.id, 
        req.user.id, 
        action, 
        comments
    );

    res.status(200).json({
      success: true,
      data: approval,
      message: `Successfully processed action: ${action}`
    });
  } catch (error) {
    next(error);
  }
};
