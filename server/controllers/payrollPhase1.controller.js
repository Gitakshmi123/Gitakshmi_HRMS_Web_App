const canonicalPayroll = require('../services/canonicalPayroll.service');
const payrollPhase1 = require('../services/payrollPhase1.service');

function getTenantId(req) {
    return req.tenantId || req.user?.tenantId || req.user?.companyId;
}

function getUserId(req) {
    return req.user?.id || req.user?._id || null;
}

function parsePeriod(source = {}) {
    const month = parseInt(source.month, 10);
    const year = parseInt(source.year, 10);

    if (month >= 1 && month <= 12 && year >= 2000) {
        return {
            month,
            year,
            startDate: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
            endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
        };
    }

    const date = source.date ? new Date(source.date) : new Date();
    if (!Number.isNaN(date.getTime())) {
        const startDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        return {
            month: startDate.getUTCMonth() + 1,
            year: startDate.getUTCFullYear(),
            startDate,
            endDate
        };
    }

    const now = new Date();
    return {
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
        startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)),
        endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    };
}

async function findEmployee(req, tenantId, employeeId) {
    const Employee = req.tenantDB.model('Employee');
    // 1. Try search by ID (standard)
    let emp = await Employee.findOne({ _id: employeeId, tenant: tenantId }).lean();
    if (emp) return emp;

    // 2. Fallback: Search by email from req.user if available
    const email = req.user?.email;
    if (email) {
        emp = await Employee.findOne({ 
            email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
            tenant: tenantId 
        }).lean();
    }
    
    return emp;
}

function buildProfileScope(req) {
    const query = req.query || {};
    const body = req.body || {};
    return {
        workState: query.workState || body.workState || '',
        payrollRegion: query.payrollRegion || body.payrollRegion || '',
        workCity: query.workCity || body.workCity || '',
        country: query.country || body.country || 'IN'
    };
}

exports.getCurrentStatutoryRuleSet = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { startDate, endDate, month, year } = parsePeriod(req.query);
        const requestedReferenceDate = req.query?.asOfDate || req.query?.date || null;
        const referenceDate = requestedReferenceDate ? new Date(requestedReferenceDate) : endDate;
        const resolvedReferenceDate = Number.isNaN(referenceDate.getTime()) ? endDate : referenceDate;
        const { employeeId } = req.query;
        let payrollProfile = null;

        if (employeeId) {
            const employee = await findEmployee(req, tenantId, employeeId);
            if (!employee) {
                return res.status(404).json({ success: false, message: 'Employee not found' });
            }

            payrollProfile = await canonicalPayroll.resolvePayrollProfile(
                req.tenantDB,
                tenantId,
                employeeId,
                startDate,
                endDate
            );
        } else {
            payrollProfile = buildProfileScope(req);
        }

        const effectiveRuleSet = await payrollPhase1.resolveStatutoryRuleSet(
            req.tenantDB,
            tenantId,
            startDate,
            endDate,
            payrollProfile,
            { createIfMissing: false, referenceDate: resolvedReferenceDate }
        );

        res.json({
            success: true,
            data: {
                month,
                year,
                payrollProfile,
                effectiveRuleSet,
                snapshot: payrollPhase1.buildStatutoryRuleSnapshot(effectiveRuleSet)
            }
        });
    } catch (error) {
        console.error('[getCurrentStatutoryRuleSet] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createStatutoryRuleSet = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const presetKey = req.body?.presetKey || req.body?.preset?.key;

        if (presetKey) {
            const seeded = await payrollPhase1.seedStatutoryRulePreset(
                req.tenantDB,
                tenantId,
                presetKey,
                req.body,
                getUserId(req)
            );

            return res.status(201).json({
                success: true,
                data: seeded,
                message: `Statutory preset ${presetKey} seeded successfully`
            });
        }

        const ruleSet = await payrollPhase1.createStatutoryRuleSet(
            req.tenantDB,
            tenantId,
            req.body,
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: ruleSet,
            message: 'Statutory rule set created successfully'
        });
    } catch (error) {
        console.error('[createStatutoryRuleSet] Error:', error);
        const status = /overlap|effective/i.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};


exports.getStatutoryRulePresets = async (_req, res) => {
    try {
        res.json({
            success: true,
            data: payrollPhase1.getStatutoryRulePresetCatalog()
        });
    } catch (error) {
        console.error('[getStatutoryRulePresets] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.seedStatutoryRulePreset = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const presetKey = req.params?.presetKey || req.body?.presetKey || req.body?.preset?.key;
        if (!presetKey) {
            return res.status(400).json({ success: false, message: 'presetKey is required' });
        }

        const seeded = await payrollPhase1.seedStatutoryRulePreset(
            req.tenantDB,
            tenantId,
            presetKey,
            req.body || {},
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: seeded,
            message: `Statutory preset ${presetKey} seeded successfully`
        });
    } catch (error) {
        console.error('[seedStatutoryRulePreset] Error:', error);
        const status = /preset|overlap|effective/i.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getEmployeeTaxProfile = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user.tenantId || req.user.tenant;
        const db = await require('../utils/tenantDB')(tenantId);
        
        if (!db) {
            return res.status(500).json({ success: false, message: 'DB Connection Failed' });
        }

        const Employee = db.model('Employee');
        const TaxProfile = db.model('TaxProfile');
        const { employeeId } = req.params;
        const { startDate, endDate } = parsePeriod(req.query);

        console.log(`[getMyTaxProfile] Searching for employee. UserID: ${req.user.id}, Email: ${req.user.email}`);

        const employee = await Employee.findOne({
            $or: [{ _id: req.user.id }, { email: req.user.email }]
        }).lean();

        if (!employee) {
            console.warn(`[getMyTaxProfile] Employee profile NOT FOUND. UserID: ${req.user.id}, Email: ${req.user.email}`);
            return res.status(404).json({ success: false, message: 'Employee profile not found' });
        }

        const EmployeeTaxProfile = req.tenantDB.model('EmployeeTaxProfile');
        const [effectiveProfile, history] = await Promise.all([
            payrollPhase1.resolveEmployeeTaxProfile(req.tenantDB, tenantId, employeeId, startDate, endDate),
            EmployeeTaxProfile.find({ tenantId, employeeId }).sort({ effectiveFrom: -1, createdAt: -1 }).lean()
        ]);

        res.json({
            success: true,
            data: {
                effectiveProfile,
                snapshot: payrollPhase1.buildTaxProfileSnapshot(effectiveProfile, startDate),
                history
            }
        });
    } catch (error) {
        console.error('[getEmployeeTaxProfile] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createEmployeeTaxProfile = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { employeeId } = req.params;

        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const profile = await payrollPhase1.createEmployeeTaxProfile(
            req.tenantDB,
            tenantId,
            employeeId,
            req.body,
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: profile,
            message: 'Employee tax profile created successfully'
        });
    } catch (error) {
        console.error('[createEmployeeTaxProfile] Error:', error);
        const status = /overlap|effective/i.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getMyTaxProfile = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const employeeId = req.user?.id || req.user?._id;
        const { startDate, endDate } = parsePeriod(req.query);

        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.json({
                success: true,
                data: {
                    employeeId: null,
                    employeeMissing: true,
                    effectiveProfile: null,
                    snapshot: payrollPhase1.buildTaxProfileSnapshot(null, startDate),
                    history: []
                }
            });
        }

        const EmployeeTaxProfile = req.tenantDB.model('EmployeeTaxProfile');
        const [effectiveProfile, history] = await Promise.all([
            payrollPhase1.resolveEmployeeTaxProfile(req.tenantDB, tenantId, employee._id, startDate, endDate),
            EmployeeTaxProfile.find({ tenantId, employeeId: employee._id }).sort({ effectiveFrom: -1, createdAt: -1 }).lean()
        ]);

        res.json({
            success: true,
            data: {
                employeeId,
                effectiveProfile,
                snapshot: payrollPhase1.buildTaxProfileSnapshot(effectiveProfile, startDate),
                history
            }
        });
    } catch (error) {
        console.error('[getMyTaxProfile] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createMyTaxProfile = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const employeeId = req.user?.id || req.user?._id;

        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const employee = await findEmployee(req, tenantId, employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const payload = {
            ...(req.body || {}),
            closePrevious: req.body?.closePrevious === false ? false : true
        };

        const profile = await payrollPhase1.createEmployeeTaxProfile(
            req.tenantDB,
            tenantId,
            employee._id,
            payload,
            getUserId(req)
        );

        res.status(201).json({
            success: true,
            data: profile,
            message: 'Tax declaration saved successfully'
        });
    } catch (error) {
        console.error('[createMyTaxProfile] Error:', error);
        const status = /overlap|effective/i.test(error.message) ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

exports.getPayrollRunAudit = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const PayrollRun = req.tenantDB.model('PayrollRun');
        const PayrollRunItem = req.tenantDB.model('PayrollRunItem');
        const Payslip = req.tenantDB.model('Payslip');
        const PayrollInputSnapshot = req.tenantDB.model('PayrollInputSnapshot');
        const PayrollCalculationTrace = req.tenantDB.model('PayrollCalculationTrace');

        const payrollRun = await PayrollRun.findOne({ _id: id, tenantId }).lean();
        if (!payrollRun) {
            return res.status(404).json({ success: false, message: 'Payroll run not found' });
        }

        const [runItems, payslips] = await Promise.all([
            PayrollRunItem.find({ tenantId, payrollRunId: id })
                .populate('employeeId', 'firstName lastName employeeId department designation')
                .sort({ createdAt: 1 })
                .lean(),
            Payslip.find({ tenantId, payrollRunId: id })
                .select('employeeId status grossEarnings netPay incomeTax attendanceSummary salarySourceSnapshot payrollProfileSnapshot locationPolicySnapshot statutoryRuleSnapshot taxProfileSnapshot payrollInputSnapshotId calculationTraceId varianceSnapshot approvedBy approvedAt paidAt')
                .lean()
        ]);

        const inputSnapshotIds = runItems.map((item) => item.inputSnapshotId).filter(Boolean);
        const calculationTraceIds = runItems.map((item) => item.calculationTraceId).filter(Boolean);

        const [inputSnapshots, calculationTraces] = await Promise.all([
            inputSnapshotIds.length
                ? PayrollInputSnapshot.find({ _id: { $in: inputSnapshotIds } }).lean()
                : [],
            calculationTraceIds.length
                ? PayrollCalculationTrace.find({ _id: { $in: calculationTraceIds } }).lean()
                : []
        ]);

        const payslipByEmployeeId = new Map(payslips.map((payslip) => [String(payslip.employeeId), payslip]));
        const inputSnapshotMap = new Map(inputSnapshots.map((item) => [String(item._id), item]));
        const traceMap = new Map(calculationTraces.map((item) => [String(item._id), item]));

        const items = runItems.map((item) => {
            const employeeKey = String(item.employeeId?._id || item.employeeId);
            const payslip = payslipByEmployeeId.get(employeeKey) || null;
            return {
                ...item,
                payslip,
                inputSnapshot: item.inputSnapshotId ? inputSnapshotMap.get(String(item.inputSnapshotId)) || null : null,
                calculationTrace: item.calculationTraceId ? traceMap.get(String(item.calculationTraceId)) || null : null
            };
        });

        res.json({
            success: true,
            data: {
                payrollRun,
                summary: {
                    items: items.length,
                    payslips: payslips.length,
                    draftPayslips: payslips.filter((item) => item.status === 'DRAFT').length,
                    approvedPayslips: payslips.filter((item) => item.status === 'APPROVED').length,
                    paidPayslips: payslips.filter((item) => item.status === 'PAID').length
                },
                items
            }
        });
    } catch (error) {
        console.error('[getPayrollRunAudit] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
