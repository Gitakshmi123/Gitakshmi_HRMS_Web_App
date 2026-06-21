const mongoose = require('mongoose');

exports.createLeaveType = async (req, res) => {
    try {
        const LeaveType = req.tenantDB.model('LeaveType');
        const { name, code, description, isPaid, color, isActive } = req.body;

        if (!name || !code) {
            return res.status(400).json({ success: false, error: 'Name and Code are required' });
        }

        const existing = await LeaveType.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, error: `Leave Type with code ${code} already exists` });
        }

        const leaveType = new LeaveType({
            tenant: req.tenantId,
            name,
            code: code.toUpperCase(),
            description,
            isPaid,
            color,
            isActive
        });

        await leaveType.save();
        return res.status(201).json({ success: true, data: leaveType, message: 'Leave Type created successfully' });
    } catch (err) {
        console.error('[LeaveType Create] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.getLeaveTypes = async (req, res) => {
    try {
        const LeaveType = req.tenantDB.model('LeaveType');
        const types = await LeaveType.find({ tenant: req.tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: types });
    } catch (err) {
        console.error('[LeaveType Get] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateLeaveType = async (req, res) => {
    try {
        const LeaveType = req.tenantDB.model('LeaveType');
        const { id } = req.params;
        const updates = req.body;
        
        if (updates.code) updates.code = updates.code.toUpperCase();

        const type = await LeaveType.findOneAndUpdate(
            { _id: id, tenant: req.tenantId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!type) {
            return res.status(404).json({ success: false, error: 'Leave Type not found' });
        }

        return res.status(200).json({ success: true, data: type, message: 'Leave Type updated successfully' });
    } catch (err) {
        console.error('[LeaveType Update] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteLeaveType = async (req, res) => {
    try {
        const LeaveType = req.tenantDB.model('LeaveType');
        const { id } = req.params;

        // Optionally check if this leave type is used in any active LeavePolicy rules.
        const LeavePolicy = req.tenantDB.model('LeavePolicy');
        const inUse = await LeavePolicy.exists({ tenant: req.tenantId, "rules.leaveType": id }); 
        // Note: The UI will probably store the code or name. If code:
        const type = await LeaveType.findOne({ _id: id, tenant: req.tenantId });
        if (!type) return res.status(404).json({ success: false, error: 'Leave Type not found' });

        const usedInPolicy = await LeavePolicy.exists({ tenant: req.tenantId, "rules.leaveType": type.code });
        if (usedInPolicy) {
            return res.status(400).json({ success: false, error: `Cannot delete: Leave Type ${type.code} is assigned to one or more Leave Groups.` });
        }

        await LeaveType.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: 'Leave Type deleted successfully' });
    } catch (err) {
        console.error('[LeaveType Delete] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};
