const mongoose = require('mongoose');
const { resolveAuthenticatedEmployee } = require('../utils/employeeAuthResolver');

const LeaveEncashmentConfigSchema = require('../models/LeaveEncashmentConfig');
const LeaveEncashmentRequestSchema = require('../models/LeaveEncashmentRequest');
const LeaveLedgerSchema = require('../models/LeaveLedger');
const LeaveBalanceSchema = require('../models/LeaveBalance');
const EmployeeCompensationSchema = require('../models/EmployeeCompensation');

// ─── Model Resolver ────────────────────────────────────────────────────────────
const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database not initialized.');
    }
    const db = req.tenantDB;
    const safe = (name, schema) => {
        try { return db.model(name); }
        catch (_) { return db.model(name, schema); }
    };
    return {
        LeaveEncashmentConfig:  safe('LeaveEncashmentConfig',  LeaveEncashmentConfigSchema),
        LeaveEncashmentRequest: safe('LeaveEncashmentRequest', LeaveEncashmentRequestSchema),
        LeaveLedger:            safe('LeaveLedger',            LeaveLedgerSchema),
        LeaveBalance:           safe('LeaveBalance',           LeaveBalanceSchema),
        EmployeeCompensation:   safe('EmployeeCompensation',   EmployeeCompensationSchema),
    };
};

// ─── Helper: Calculate payout amount ──────────────────────────────────────────
function calculatePayout(basicSalary, days, formula) {
    if (!basicSalary || basicSalary <= 0 || !days || days <= 0) return 0;
    const perDay = basicSalary / 30;
    return Math.round(perDay * days);
}

// ─── Helper: Get employee's basic salary from EmployeeCompensation ─────────────
async function getEmployeeBasicSalary(req, employeeId) {
    try {
        const db = req.tenantDB;
        const Comp = db ? (() => { try { return db.model('EmployeeCompensation'); } catch(_) { return db.model('EmployeeCompensation', EmployeeCompensationSchema); } })() : null;
        if (!Comp) return 0;

        const comp = await Comp.findOne({
            employeeId,
            isActive: true,
            status: { $in: ['ACTIVE', 'Active'] },
            totalCTC: { $gt: 0 }
        }).lean();

        if (!comp) return 0;

        const components = comp.components || [];
        let basicMonthly = 0;
        for (const c of components) {
            if ((c.type || '').toUpperCase() !== 'EARNING') continue;
            const monthly = Number(c.monthlyAmount) || (Number(c.annualAmount) || 0) / 12;
            const name = ((c.name || c.code || '') + '').toLowerCase();
            if (name.includes('basic')) {
                basicMonthly += monthly;
            }
        }
        if (basicMonthly > 0) return Math.round(basicMonthly);
        // Fallback: 40% of monthly CTC
        const monthlyCTC = Math.round((Number(comp.totalCTC) || 0) / 12);
        return Math.round(monthlyCTC * 0.4);
    } catch (e) {
        console.warn('[leaveEncashment] getEmployeeBasicSalary error:', e.message);
        return 0;
    }
}

// ─── Helper: Log to LeaveLedger ────────────────────────────────────────────────
async function logLedger(req, { LeaveLedger, LeaveBalance, employeeId, leaveType, year, days, remarks, referenceId }) {
    try {
        const balanceObj = await LeaveBalance.findOne({
            tenant: req.tenantId,
            employee: employeeId,
            leaveType: leaveType.toUpperCase(),
            year
        }).lean();
        const newBalance = balanceObj ? (balanceObj.available || 0) : 0;
        const previousBalance = newBalance + Math.abs(days); // days is negative for deductions

        let creatorName = 'System';
        if (req.user) {
            creatorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() ||
                req.user.name || req.user.email || 'HR';
        }

        await LeaveLedger.create({
            tenant: req.tenantId,
            employee: employeeId,
            leaveType: leaveType.toUpperCase(),
            year,
            actionType: 'Encashment',
            days,
            previousBalance,
            newBalance,
            remarks: remarks || 'Leave Encashment',
            referenceId: referenceId || null,
            referenceModel: 'LeaveEncashmentRequest',
            date: new Date(),
            createdBy: creatorName
        });
    } catch (e) {
        console.error('[leaveEncashment] logLedger error:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /hr/leaves/encashment/config  (HR)
// GET /employee/leaves/encashment/config  (Employee - read only)
// ═══════════════════════════════════════════════════════════════════════════════
exports.getConfig = async (req, res) => {
    try {
        const { LeaveEncashmentConfig } = getModels(req);
        let config = await LeaveEncashmentConfig.findOne({ tenant: req.tenantId }).lean();
        if (!config) {
            // Find a dynamic default encashable leave type
            const LeavePolicy = req.tenantDB.model('LeavePolicy');
            const policies = await LeavePolicy.find({ tenant: req.tenantId }).lean();
            let defaultEncashableType = 'EL';
            for (const p of policies) {
                for (const r of (p.rules || [])) {
                    if (r.encashmentAllowed) {
                        defaultEncashableType = r.leaveType;
                        break;
                    }
                }
                if (defaultEncashableType !== 'EL') break;
            }

            config = {
                allowed: false,
                leaveType: defaultEncashableType,
                formula: 'Basic / 30',
                minBalanceRetain: 15,
                maxEncashableDays: 10,
                taxRule: 'Exempt up to 3 Lakhs'
            };
        }

        // Fetch employee's basic salary if request is from employee
        let basicSalary = 0;
        try {
            const employee = await resolveAuthenticatedEmployee(req, { select: '_id' }).catch(() => null);
            if (employee) {
                basicSalary = await getEmployeeBasicSalary(req, employee._id);
            }
        } catch (e) {
            console.warn('[leaveEncashment] getConfig basicSalary error:', e.message);
        }

        return res.json({ success: true, config, basicSalary });
    } catch (err) {
        console.error('[leaveEncashment] getConfig error:', err);
        return res.status(500).json({ error: 'Failed to fetch encashment configuration.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /hr/leaves/encashment/config  (HR only)
// ═══════════════════════════════════════════════════════════════════════════════
exports.saveConfig = async (req, res) => {
    try {
        const { LeaveEncashmentConfig } = getModels(req);
        const { allowed, leaveType, formula, minBalanceRetain, maxEncashableDays, taxRule } = req.body;

        // Find a dynamic default if leaveType is missing
        let defaultEncashableType = 'EL';
        if (!leaveType) {
            const LeavePolicy = req.tenantDB.model('LeavePolicy');
            const policies = await LeavePolicy.find({ tenant: req.tenantId }).lean();
            for (const p of policies) {
                for (const r of (p.rules || [])) {
                    if (r.encashmentAllowed) {
                        defaultEncashableType = r.leaveType;
                        break;
                    }
                }
                if (defaultEncashableType !== 'EL') break;
            }
        }

        const config = await LeaveEncashmentConfig.findOneAndUpdate(
            { tenant: req.tenantId },
            {
                tenant: req.tenantId,
                allowed: Boolean(allowed),
                leaveType: leaveType || defaultEncashableType,
                formula: formula || 'Basic / 30',
                minBalanceRetain: Number(minBalanceRetain) || 15,
                maxEncashableDays: Number(maxEncashableDays) || 10,
                taxRule: taxRule || 'Exempt up to 3 Lakhs'
            },
            { upsert: true, new: true, runValidators: true }
        );

        return res.json({ success: true, config });
    } catch (err) {
        console.error('[leaveEncashment] saveConfig error:', err);
        return res.status(500).json({ error: 'Failed to save encashment configuration.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /employee/leaves/encashment/requests  (Employee - apply for encashment)
// ═══════════════════════════════════════════════════════════════════════════════
exports.applyRequest = async (req, res) => {
    try {
        const { LeaveEncashmentConfig, LeaveEncashmentRequest, LeaveBalance } = getModels(req);

        // Resolve the authenticated employee
        const employee = await resolveAuthenticatedEmployee(req, { select: '_id name firstName lastName employeeId' });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        // Fetch and validate configuration
        const config = await LeaveEncashmentConfig.findOne({ tenant: req.tenantId }).lean();
        if (!config || !config.allowed) {
            return res.status(403).json({ error: 'Leave encashment is not enabled for your company.' });
        }

        const { requestedDays, reason } = req.body;
        const days = Number(requestedDays);
        if (!days || days <= 0 || !Number.isInteger(days)) {
            return res.status(400).json({ error: 'Please enter a valid number of days to encash.' });
        }

        // Validate against maxEncashableDays
        if (days > config.maxEncashableDays) {
            return res.status(400).json({
                error: `You can encash a maximum of ${config.maxEncashableDays} days per year.`
            });
        }

        // Check current leave balance
        const year = new Date().getFullYear();
        const balance = await LeaveBalance.findOne({
            tenant: req.tenantId,
            employee: employee._id,
            leaveType: config.leaveType.toUpperCase(),
            year
        }).lean();

        const available = balance ? (balance.available || 0) : 0;

        // Validate minimum retained balance
        if (available - days < config.minBalanceRetain) {
            return res.status(400).json({
                error: `After encashment you must retain at least ${config.minBalanceRetain} days. Current balance: ${available}, After encashment: ${available - days}.`
            });
        }

        // Check for pending requests (prevent duplicate)
        const existingPending = await LeaveEncashmentRequest.findOne({
            tenant: req.tenantId,
            employee: employee._id,
            status: 'Pending'
        }).lean();
        if (existingPending) {
            return res.status(400).json({ error: 'You already have a pending encashment request. Please wait for it to be processed.' });
        }

        // Get basic salary
        const basicSalary = await getEmployeeBasicSalary(req, employee._id);
        if (!basicSalary) {
            return res.status(400).json({ error: 'Salary information not found. Please contact HR.' });
        }

        const payoutAmount = calculatePayout(basicSalary, days, config.formula);

        const encashRequest = await LeaveEncashmentRequest.create({
            tenant: req.tenantId,
            employee: employee._id,
            leaveType: config.leaveType.toUpperCase(),
            requestedDays: days,
            availableBalance: available,
            basicSalary,
            payoutAmount,
            formulaUsed: config.formula,
            reason: reason || '',
            status: 'Pending'
        });

        return res.status(201).json({
            success: true,
            message: 'Encashment request submitted successfully. Awaiting HR approval.',
            request: encashRequest
        });
    } catch (err) {
        console.error('[leaveEncashment] applyRequest error:', err);
        return res.status(500).json({ error: 'Failed to submit encashment request.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /employee/leaves/encashment/requests  (Employee - own requests)
// ═══════════════════════════════════════════════════════════════════════════════
exports.getMyRequests = async (req, res) => {
    try {
        const { LeaveEncashmentRequest } = getModels(req);
        const employee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const requests = await LeaveEncashmentRequest.find({
            tenant: req.tenantId,
            employee: employee._id
        }).sort({ createdAt: -1 }).lean();

        return res.json({ success: true, requests });
    } catch (err) {
        console.error('[leaveEncashment] getMyRequests error:', err);
        return res.status(500).json({ error: 'Failed to fetch encashment requests.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /employee/leaves/encashment/requests/:id/cancel  (Employee)
// ═══════════════════════════════════════════════════════════════════════════════
exports.cancelRequest = async (req, res) => {
    try {
        const { LeaveEncashmentRequest } = getModels(req);
        const employee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const request = await LeaveEncashmentRequest.findOne({
            _id: req.params.id,
            tenant: req.tenantId,
            employee: employee._id
        });
        if (!request) return res.status(404).json({ error: 'Request not found.' });
        if (request.status !== 'Pending') {
            return res.status(400).json({ error: `Cannot cancel a request that is already ${request.status}.` });
        }

        request.status = 'Cancelled';
        request.cancelledAt = new Date();
        await request.save();

        return res.json({ success: true, message: 'Request cancelled successfully.' });
    } catch (err) {
        console.error('[leaveEncashment] cancelRequest error:', err);
        return res.status(500).json({ error: 'Failed to cancel request.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /hr/leaves/encashment/requests  (HR - all requests)
// ═══════════════════════════════════════════════════════════════════════════════
exports.getAllRequests = async (req, res) => {
    try {
        const { LeaveEncashmentRequest } = getModels(req);

        const filter = { tenant: req.tenantId };
        if (req.query.status) filter.status = req.query.status;

        const db = req.tenantDB;
        let Employee;
        try { Employee = db.model('Employee'); } catch (_) { Employee = null; }

        const requests = await LeaveEncashmentRequest.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        // Attach employee info
        if (Employee && requests.length > 0) {
            const empIds = [...new Set(requests.map(r => String(r.employee)))];
            const employees = await Employee.find({
                _id: { $in: empIds }
            }).select('_id firstName lastName name employeeId department').lean();

            const empMap = {};
            employees.forEach(e => { empMap[String(e._id)] = e; });

            requests.forEach(r => {
                r.employeeInfo = empMap[String(r.employee)] || null;
            });
        }

        return res.json({ success: true, requests });
    } catch (err) {
        console.error('[leaveEncashment] getAllRequests error:', err);
        return res.status(500).json({ error: 'Failed to fetch encashment requests.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /hr/leaves/encashment/requests/:id/approve  (HR)
// ═══════════════════════════════════════════════════════════════════════════════
exports.approveRequest = async (req, res) => {
    try {
        const { LeaveEncashmentRequest, LeaveBalance, LeaveLedger } = getModels(req);

        const actorEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        const request = await LeaveEncashmentRequest.findOne({
            _id: req.params.id,
            tenant: req.tenantId
        });
        if (!request) return res.status(404).json({ error: 'Request not found.' });
        if (request.status !== 'Pending') {
            return res.status(400).json({ error: `Request is already ${request.status}.` });
        }

        const year = new Date(request.createdAt).getFullYear();

        // Deduct from leave balance
        const balance = await LeaveBalance.findOne({
            tenant: req.tenantId,
            employee: request.employee,
            leaveType: request.leaveType.toUpperCase(),
            year
        });

        if (!balance) {
            return res.status(400).json({ error: 'Leave balance record not found for this employee.' });
        }

        const available = balance.available || 0;
        if (available < request.requestedDays) {
            return res.status(400).json({
                error: `Insufficient leave balance. Available: ${available}, Requested: ${request.requestedDays}`
            });
        }

        // Perform deduction — treat as "used" days
        balance.used = (balance.used || 0) + request.requestedDays;
        balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
        await balance.save();

        // Log to ledger
        await logLedger(req, {
            LeaveLedger,
            LeaveBalance,
            employeeId: request.employee,
            leaveType: request.leaveType,
            year,
            days: -request.requestedDays,
            remarks: `Leave Encashment - ${request.requestedDays} days encashed. Payout: ₹${request.payoutAmount.toLocaleString()}`,
            referenceId: request._id
        });

        // Update request status
        request.status = 'Approved';
        request.approvedAt = new Date();
        if (actorEmployee) request.actionBy = actorEmployee._id;
        if (req.body.adminRemark) request.adminRemark = req.body.adminRemark;
        await request.save();

        return res.json({
            success: true,
            message: `Encashment approved. ${request.requestedDays} days deducted. Payout: ₹${request.payoutAmount.toLocaleString()}`,
            request
        });
    } catch (err) {
        console.error('[leaveEncashment] approveRequest error:', err);
        return res.status(500).json({ error: 'Failed to approve encashment request.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /hr/leaves/encashment/requests/:id/reject  (HR)
// ═══════════════════════════════════════════════════════════════════════════════
exports.rejectRequest = async (req, res) => {
    try {
        const { LeaveEncashmentRequest } = getModels(req);

        const actorEmployee = await resolveAuthenticatedEmployee(req, { select: '_id' });
        const request = await LeaveEncashmentRequest.findOne({
            _id: req.params.id,
            tenant: req.tenantId
        });
        if (!request) return res.status(404).json({ error: 'Request not found.' });
        if (request.status !== 'Pending') {
            return res.status(400).json({ error: `Request is already ${request.status}.` });
        }

        request.status = 'Rejected';
        request.rejectedAt = new Date();
        if (actorEmployee) request.actionBy = actorEmployee._id;
        if (req.body.adminRemark) request.adminRemark = req.body.adminRemark;
        await request.save();

        return res.json({ success: true, message: 'Encashment request rejected.', request });
    } catch (err) {
        console.error('[leaveEncashment] rejectRequest error:', err);
        return res.status(500).json({ error: 'Failed to reject encashment request.' });
    }
};
