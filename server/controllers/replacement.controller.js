const mongoose = require('mongoose');

function getModels(req) {
    const db = req.tenantDB;
    return {
        ReplacementRequest: db.model("ReplacementRequest"),
        Employee: db.model("Employee"),
        Department: db.model("Department"),
        Position: db.model("Position"),
        Requirement: db.model("Requirement")
    };
}

/**
 * List all replacement requests
 */
exports.listRequests = async (req, res) => {
    try {
        const { ReplacementRequest } = getModels(req);
        const { status, departmentId } = req.query;

        const filter = { tenant: req.tenantId };
        if (status) filter.replacementStatus = status;
        if (departmentId) filter.departmentId = departmentId;

        const requests = await ReplacementRequest.find(filter)
            .populate('oldEmployeeId', 'firstName lastName employeeId')
            .populate('departmentId', 'name')
            .populate('positionId', 'title')
            .populate('hiredEmployeeId', 'firstName lastName employeeId')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Create a new replacement request
 */
exports.createRequest = async (req, res) => {
    try {
        const { ReplacementRequest, Employee } = getModels(req);
        const { employeeId, reason, urgency, slaDays } = req.body;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        // Check if replacement already exists
        const existing = await ReplacementRequest.findOne({
            oldEmployeeId: employeeId,
            replacementStatus: { $ne: 'closed' }
        });
        if (existing) {
            return res.status(400).json({ success: false, message: "Replacement request already exists for this employee" });
        }

        const request = await ReplacementRequest.create({
            tenant: req.tenantId,
            oldEmployeeId: employeeId,
            departmentId: employee.departmentId,
            positionId: employee.positionId,
            reason,
            urgency: urgency || 'medium',
            slaDays: slaDays || 30,
            approvalStatus: 'pending',
            replacementStatus: 'open',
            createdBy: req.user.id
        });

        // Link request to employee
        employee.replacementRequired = true;
        employee.replacementId = request._id;
        await employee.save();

        res.status(201).json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Approve or Reject a replacement request
 */
exports.approveRequest = async (req, res) => {
    try {
        const { ReplacementRequest, Requirement } = getModels(req);
        const { id } = req.params;
        const { status, notes } = req.body; // approved | rejected

        const request = await ReplacementRequest.findById(id);
        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        // Role based logic
        // HR creates -> Dept Head approves -> Admin final (simplified for this task)
        // We'll check if status is 'approved'
        request.approvalStatus = status;
        if (status === 'approved') {
            request.approvedDate = new Date();

            // Auto create JobRequisition
            const requisition = await Requirement.create({
                tenant: req.tenantId,
                jobTitle: "Replacement for " + request.oldEmployeeId, // Will populate properly in frontend or use a look-up
                departmentId: request.departmentId,
                positionId: request.positionId,
                isReplacement: true,
                replacementId: request._id,
                approvalStatus: 'Approved',
                hiringStatus: 'Open',
                vacancy: 1
            });

            request.replacementStatus = 'hiring';
        }

        await request.save();
        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Get single request details
 */
exports.getRequest = async (req, res) => {
    try {
        const { ReplacementRequest } = getModels(req);
        const request = await ReplacementRequest.findById(req.params.id)
            .populate('oldEmployeeId')
            .populate('departmentId')
            .populate('positionId')
            .populate('hiredEmployeeId');

        if (!request) return res.status(404).json({ success: false, message: "Not found" });

        res.json({ success: true, data: request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
