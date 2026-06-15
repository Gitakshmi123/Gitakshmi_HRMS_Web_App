const ManpowerRequisition = require('../models/ManpowerRequisition');
const WorkflowStartService = require('../services/workflowStart.service');

exports.createRequisition = async (req, res) => {
  try {
    const { tenantId, user } = req;
    
    const requisitionData = {
      ...req.body,
      tenant: tenantId,
      requestedBy: user._id, // Assume logged in user is requester
      status: 'Pending'
    };
    
    const requisition = new ManpowerRequisition(requisitionData);
    await requisition.save();
    
    // Start approval workflow
    const contextData = {
      requisitionId: requisition._id.toString(),
      department: requisition.department.toString(),
      requirementType: requisition.requirementType
    };
    
    const workflowParams = {
      tenantId,
      moduleKey: 'recruitment',
      entityType: 'ManpowerRequisition',
      entityId: requisition._id.toString(),
      requesterId: user._id.toString(),
      contextData
    };
    
    try {
        const { workflowInstance } = await WorkflowStartService.startWorkflow(workflowParams);
        requisition.workflowInstanceId = workflowInstance._id;
        await requisition.save();
    } catch (wfError) {
        console.error("Workflow starting error:", wfError);
        // We do not fail the requisition creation if workflow fails to start, but we should log it
        // Depending on business logic, we could revert the requisition.
    }
    
    res.status(201).json({ success: true, data: requisition });
  } catch (error) {
    console.error("Error creating Manpower Requisition:", error);
    res.status(500).json({ success: false, message: "Error creating Manpower Requisition", error: error.message });
  }
};

exports.getRequisitions = async (req, res) => {
  try {
    const { tenantId, user } = req;
    // For ESS, fetch requisitions created by this user
    const requisitions = await ManpowerRequisition.find({ tenant: tenantId, requestedBy: user._id })
      .populate('department designation replacementAgainstDesignation')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: requisitions });
  } catch (error) {
    console.error("Error fetching requisitions:", error);
    res.status(500).json({ success: false, message: "Error fetching Manpower Requisitions", error: error.message });
  }
};

exports.getRequisitionById = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    
    const requisition = await ManpowerRequisition.findOne({ _id: id, tenant: tenantId })
      .populate('department designation replacementAgainstDesignation requestedBy workflowInstanceId');
      
    if (!requisition) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }
    
    res.status(200).json({ success: true, data: requisition });
  } catch (error) {
    console.error("Error fetching requisition by ID:", error);
    res.status(500).json({ success: false, message: "Error fetching Manpower Requisition", error: error.message });
  }
};

// Assuming there's a webhook or callback when a workflow completes
// This might be implemented in the workflow completion service, but it's good to have a handler here
exports.updateRequisitionStatus = async (req, res) => {
    try {
        const { tenantId } = req;
        const { id } = req.params;
        const { status } = req.body;
        
        const requisition = await ManpowerRequisition.findOneAndUpdate(
            { _id: id, tenant: tenantId },
            { status },
            { new: true }
        );
        
        if (!requisition) {
            return res.status(404).json({ success: false, message: 'Requisition not found' });
        }
        
        res.status(200).json({ success: true, data: requisition });
    } catch (error) {
        console.error("Error updating requisition status:", error);
        res.status(500).json({ success: false, message: "Error updating Manpower Requisition status", error: error.message });
    }
};
