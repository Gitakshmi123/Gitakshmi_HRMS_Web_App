const HolidayGroupSchema = require('../models/HolidayGroup');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        HolidayGroup: db.model('HolidayGroup', HolidayGroupSchema)
    };
};

// GET ALL HOLIDAY GROUPS
exports.getHolidayGroups = async (req, res) => {
    try {
        const { HolidayGroup } = getModels(req);
        const groups = await HolidayGroup.find({ tenant: req.tenantId }).sort({ createdAt: -1 });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET HOLIDAY GROUP BY ID
exports.getHolidayGroupById = async (req, res) => {
    try {
        const { HolidayGroup } = getModels(req);
        const group = await HolidayGroup.findOne({ _id: req.params.id, tenant: req.tenantId });
        if (!group) return res.status(404).json({ error: "Holiday group not found" });
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// CREATE HOLIDAY GROUP
exports.createHolidayGroup = async (req, res) => {
    try {
        const { HolidayGroup } = getModels(req);
        const { name, year, description, status, applicability, holidays } = req.body;

        if (!name || !year) {
            return res.status(400).json({ error: "Name and Year are required fields" });
        }

        // Check if group already exists
        const exists = await HolidayGroup.findOne({ tenant: req.tenantId, name, year });
        if (exists) {
            return res.status(400).json({ error: "A Holiday Group with this name and year already exists." });
        }

        const newGroup = new HolidayGroup({
            tenant: req.tenantId,
            name,
            year,
            description,
            status: status || 'Active',
            applicability: applicability || { type: 'All' },
            holidays: holidays || [],
            auditLogs: [{
                performedBy: req.user?.name || 'HR Admin',
                action: 'HOLIDAY_GROUP_CREATED',
                newValue: `Created Holiday Group ${name} for ${year}`
            }]
        });

        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// UPDATE HOLIDAY GROUP
exports.updateHolidayGroup = async (req, res) => {
    try {
        const { HolidayGroup } = getModels(req);
        const { id } = req.params;
        const { name, year, description, status, applicability, holidays, auditLogEntry } = req.body;

        const group = await HolidayGroup.findOne({ _id: id, tenant: req.tenantId });
        if (!group) return res.status(404).json({ error: "Holiday group not found" });

        const oldGroup = group.toObject();

        if (name) group.name = name;
        if (year) group.year = year;
        if (description !== undefined) group.description = description;
        if (status) group.status = status;
        if (applicability) group.applicability = applicability;
        if (holidays) group.holidays = holidays;

        if (auditLogEntry) {
            group.auditLogs.push({
                performedBy: req.user?.name || 'HR Admin',
                action: auditLogEntry.action || 'HOLIDAY_GROUP_UPDATED',
                oldValue: auditLogEntry.oldValue || JSON.stringify(oldGroup),
                newValue: auditLogEntry.newValue || JSON.stringify(group.toObject())
            });
        }

        await group.save();
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE HOLIDAY GROUP
exports.deleteHolidayGroup = async (req, res) => {
    try {
        const { HolidayGroup } = getModels(req);
        const result = await HolidayGroup.deleteOne({ _id: req.params.id, tenant: req.tenantId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Holiday group not found" });
        }
        res.json({ message: "Holiday group deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// COPY CALENDAR / HOLIDAYS FROM EXISTING GROUP
exports.copyCalendar = async (req, res) => {
    try {
        const { HolidayGroup } = getModels(req);
        const { id } = req.params;
        const { sourceGroupId, targetYear } = req.body;

        const targetGroup = await HolidayGroup.findOne({ _id: id, tenant: req.tenantId });
        if (!targetGroup) return res.status(404).json({ error: "Target Holiday group not found" });

        const sourceGroup = await HolidayGroup.findOne({ _id: sourceGroupId, tenant: req.tenantId });
        if (!sourceGroup) return res.status(404).json({ error: "Source Holiday group not found" });

        // Copy holidays and adjust dates to the target year
        const copiedHolidays = sourceGroup.holidays.map(h => {
            const dateObj = new Date(h.date);
            dateObj.setFullYear(targetYear || targetGroup.year);
            return {
                name: h.name,
                date: dateObj,
                type: h.type,
                leaveImpact: h.leaveImpact,
                category: h.category,
                halfDayConfig: h.halfDayConfig,
                recurring: h.recurring,
                allowLeaveApplication: h.allowLeaveApplication,
                excludeFromLeaveCalc: h.excludeFromLeaveCalc,
                countAsPayable: h.countAsPayable,
                showInCalendar: h.showInCalendar,
                showInDashboard: h.showInDashboard,
                remarks: h.remarks
            };
        });

        targetGroup.holidays = [...targetGroup.holidays, ...copiedHolidays];
        targetGroup.auditLogs.push({
            performedBy: req.user?.name || 'HR Admin',
            action: 'HOLIDAYS_COPIED',
            newValue: `Copied ${copiedHolidays.length} holidays from ${sourceGroup.name}`
        });

        await targetGroup.save();
        res.json(targetGroup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
