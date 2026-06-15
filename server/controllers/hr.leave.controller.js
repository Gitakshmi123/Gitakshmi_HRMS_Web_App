const mongoose = require('mongoose');

/* ----------------------------------------------------
   HELPER → Get models from tenant database
   Models are already registered by dbManager, just retrieve them
---------------------------------------------------- */
function getModels(req) {
  if (!req.tenantDB) {
    throw new Error("Tenant database connection not available");
  }
  const db = req.tenantDB;
  try {
    // Models are already registered by dbManager, just retrieve them
    // Do NOT pass schema - use connection.model(name) only
    return {
      LeaveRequest: db.model("LeaveRequest"),
      Employee: db.model("Employee")
    };
  } catch (err) {
    console.error("[hr.leave.controller] Error retrieving models:", err.message);
    throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
  }
}

/* ----------------------------------------------------
   LIST LEAVES
---------------------------------------------------- */
exports.list = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    const { LeaveRequest } = getModels(req);

    const leaves = await LeaveRequest.find({ tenant: tenantId })
      .populate('employee', 'firstName lastName employeeId profilePic department')
      .populate('approver', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    console.error("List leaves error:", err);
    res.status(500).json({ error: "Failed to list leaves" });
  }
};

/* ----------------------------------------------------
   CREATE LEAVE
---------------------------------------------------- */
exports.create = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    const { LeaveRequest } = getModels(req);

    // If employeeId is not provided, try to infer from logged in user if possible
    // But typically HR creates for themselves or others? 
    // Usually usage: POST /hr/leaves with body { employee: 'id', ... }

    const { employee, leaveType, startDate, endDate, reason } = req.body;

    if (!employee || !leaveType || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const leave = new LeaveRequest({
      tenant: tenantId,
      employee,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'Pending'
    });

    await leave.save();

    // Populate for response
    await leave.populate('employee', 'firstName lastName');

    res.status(201).json(leave);
  } catch (err) {
    console.error("Create leave error:", err);
    res.status(500).json({ error: "Failed to create leave request" });
  }
};

/* ----------------------------------------------------
   GET SINGLE LEAVE
---------------------------------------------------- */
exports.get = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    const { LeaveRequest } = getModels(req);

    const leave = await LeaveRequest.findOne({ _id: req.params.id, tenant: tenantId })
      .populate('employee', 'firstName lastName employeeId department profilePic')
      .populate('approver', 'firstName lastName');

    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    res.json(leave);
  } catch (err) {
    console.error("Get leave error:", err);
    res.status(500).json({ error: "Failed to fetch leave request" });
  }
};

/* ----------------------------------------------------
   ACTION (Approve/Reject)
   POST /hr/leaves/:id/action
   Body: { status: 'Approved'|'Rejected', rejectionReason: '...' }
---------------------------------------------------- */
exports.action = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    const { LeaveRequest } = getModels(req);
    const { status, rejectionReason } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: "Invalid status action" });
    }

    const update = { status };
    if (status === 'Rejected') {
      update.rejectionReason = rejectionReason;
    }
    // Set approver to current user if available
    if (req.user && req.user.userId) {
      update.approver = req.user.userId;
    }

    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, tenant: tenantId },
      { $set: update },
      { new: true }
    );

    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    res.json(leave);
  } catch (err) {
    console.error("Leave action error:", err);
    res.status(500).json({ error: "Failed to update leave status" });
  }
};

/* ----------------------------------------------------
   DELETE LEAVE
---------------------------------------------------- */
exports.remove = async function (req, res) {
  try {
    const tenantId = req.tenantId;
    const { LeaveRequest } = getModels(req);

    const result = await LeaveRequest.findOneAndDelete({ _id: req.params.id, tenant: tenantId });

    if (!result) return res.status(404).json({ error: "Leave request not found" });

    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("Delete leave error:", err);
    res.status(500).json({ error: "Failed to delete leave request" });
  }
};
