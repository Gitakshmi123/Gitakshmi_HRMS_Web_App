const SalaryCalculationEngine = require('../services/salaryCalculationEngine');
const mongoose = require('mongoose');
const payrollRuleResolver = require('../services/payrollRuleResolver.service');
const salarySnapshotCanonicalSync = require('../services/salarySnapshotCanonicalSync.service');

/**
 * ============================================
 * SALARY CONTROLLER (v9.0) - ARCHITECT GRADE
 * ============================================
 */

const safeNum = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round((n + Number.EPSILON) * 100) / 100;
};

const getTenantId = (req) => req.user?.tenant || req.user?.tenantId || req.tenantId;

const normalizeText = (value = '') => String(value || '').trim();

const normalizeLocationContext = (input = {}) => ({
    country: normalizeText(input.country || 'IN') || 'IN',
    legalEntityId: input.legalEntityId || null,
    branchId: input.branchId || null,
    branchName: normalizeText(input.branchName),
    payrollRegion: normalizeText(input.payrollRegion),
    workState: normalizeText(input.workState || input.state),
    workCity: normalizeText(input.workCity || input.city),
    effectiveFrom: input.effectiveFrom || null,
    policyOverrides: input.policyOverrides || {}
});

const buildPayrollContext = async (req, locationContext = {}, options = {}) => {
    const tenantId = getTenantId(req);
    const normalizedLocation = normalizeLocationContext(locationContext || {});
    const hasRuleScope = Boolean(normalizedLocation.country || normalizedLocation.workState || normalizedLocation.workCity || normalizedLocation.payrollRegion);

    if (!req.tenantDB || !tenantId || options.applyStatutory === false || !hasRuleScope) {
        return {
            applyStatutory: options.applyStatutory !== false,
            locationContext: normalizedLocation,
            companyRules: {},
            locationPolicy: {},
            locationPolicySnapshot: null
        };
    }

    const rules = await payrollRuleResolver.getCompanyPayrollRules(req.tenantDB, tenantId, { createIfMissing: true });
    const resolvedPolicy = payrollRuleResolver.buildResolvedLocationPolicy(rules, normalizedLocation);
    const snapshot = payrollRuleResolver.buildLocationPolicySnapshot(resolvedPolicy);

    return {
        applyStatutory: options.applyStatutory !== false,
        locationContext: normalizedLocation,
        companyRules: rules,
        locationPolicy: resolvedPolicy,
        locationPolicySnapshot: snapshot
    };
};

/**
 * Mapper: Engine Result -> Database Snapshot Schema
 */
const mapToSnapshot = (result, req, extra = {}) => {
    const mapper = (list) => (list || []).map(item => ({
        code: item.code,
        name: item.name,
        calculationType: item.calculationType,
        value: item.value,
        formula: item.formula,
        formulaFrequency: item.formulaFrequency || 'MONTHLY',
        isManual: !!item.isManual,
        isSystemGenerated: !!item.isSystemGenerated,
        basedOn: item.basedOn || 'NA',
        monthlyAmount: item.monthly,
        yearlyAmount: item.yearly
    }));

    return {
        tenant: getTenantId(req),
        applicant: extra.applicant || null,
        employee: extra.employee || null,
        ctc: result.annualCTC,
        monthlyCTC: result.annualCTC / 12,
        earnings: mapper(result.earnings),
        employeeDeductions: mapper(result.deductions),
        benefits: mapper(result.benefits),
        summary: {
            grossEarnings: result.totals.grossYearly,
            totalDeductions: result.totals.deductionYearly,
            totalBenefits: result.benefits?.reduce((s, b) => s + b.yearly, 0) || 0,
            netPay: result.totals.netYearly
        },
        breakdown: {
            totalEarnings: result.totals.grossMonthly,
            totalDeductions: result.totals.deductionMonthly,
            totalBenefits: result.benefits?.reduce((s, b) => s + b.monthly, 0) || 0,
            netPay: result.totals.netMonthly
        },
        payrollContext: result.payrollContext || extra.payrollContext || {},
        effectiveFrom: extra.effectiveFrom ? new Date(extra.effectiveFrom) : new Date(),
        locked: !!extra.locked,
        reason: extra.reason || 'ASSIGNMENT',
        createdBy: req.user?._id
    };
};

/**
 * Mapper: Database Snapshot -> Frontend UI Contract
 */
const mapToContract = (s) => {
    if (!s) return null;

    const itemMapper = (list) => (list || []).map(item => ({
        code: item.code,
        name: item.name,
        monthly: item.monthlyAmount || 0,
        yearly: item.yearlyAmount || 0,
        calculationType: item.calculationType || 'FLAT',
        value: item.value || 0,
        formula: item.formula || '',
        formulaFrequency: item.formulaFrequency || 'MONTHLY',
        basedOn: item.basedOn || 'NA',
        isManual: !!item.isManual,
        isSystemGenerated: !!item.isSystemGenerated,
        _id: item._id
    }));

    return {
        annualCTC: s.ctc || 0,
        locked: !!s.locked,
        applicant: s.applicant,
        employee: s.employee,
        payrollContext: s.payrollContext || {},
        effectiveFrom: s.effectiveFrom,
        // Root lists for selection state
        earnings: itemMapper(s.earnings),
        deductions: itemMapper(s.employeeDeductions),
        benefits: itemMapper(s.benefits),
        // Breakdown for calculation display
        breakdown: {
            earnings: itemMapper(s.earnings),
            deductions: itemMapper(s.employeeDeductions),
            benefits: itemMapper(s.benefits)
        },
        totals: {
            netMonthly: s.breakdown?.netPay || 0,
            grossMonthly: s.breakdown?.totalEarnings || 0,
            deductionMonthly: s.breakdown?.totalDeductions || 0,
            netYearly: s.summary?.netPay || 0,
            grossYearly: s.summary?.grossEarnings || 0,
            deductionYearly: s.summary?.totalDeductions || 0
        }
    };
};

const SalaryController = {
    /**
 * Preview Salary
 */
    async preview(req, res) {
        try {
            const { annualCTC, selectedEarnings, selectedDeductions, selectedBenefits, locationContext, payrollContext } = req.body;
            // console.log(`[SALARY_CONTROLLER] Preview requested: CTC=${annualCTC}`);

            // Fetch actual component configurations from database
            const tenantId = req.user?.tenant || req.user?.tenantId;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: "Tenant ID missing" });
            }

            if (!req.tenantDB) {
                return res.status(400).json({ success: false, message: "Tenant database not resolved" });
            }

            const SalaryComponent = req.tenantDB.model('SalaryComponent');
            const DeductionMaster = req.tenantDB.model('DeductionMaster');
            const BenefitComponent = req.tenantDB.model('BenefitComponent');

            // Fetch all active components from database
            const [dbEarnings, dbDeductions, dbBenefits] = await Promise.all([
                SalaryComponent.find({ tenantId, isActive: true }).lean(),
                DeductionMaster.find({ tenantId, isActive: true }).lean(),
                BenefitComponent.find({ tenantId, isActive: true }).lean()
            ]);


            // console.log(`🔍 DEBUG: Fetched ${dbEarnings.length} earnings, ${dbDeductions.length} deductions, ${dbBenefits.length} benefits from DB`);

            // Helper to merge selected components with DB configurations
            const mergeWithDB = (selectedList, dbList) => {
                const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '');

                return (selectedList || []).map(selected => {
                    // Find matching DB component
                    const dbComp = dbList.find(db =>
                        (db._id && selected._id && db._id.toString() === selected._id.toString()) ||
                        (db.name && selected.name && normalize(db.name) === normalize(selected.name)) ||
                        (db.code && selected.code && db.code.toUpperCase() === selected.code.toUpperCase())
                    );

                    if (dbComp) {
                        return {
                            ...selected,
                            ...dbComp,
                            _id: dbComp._id,
                            calculationType: selected.formula ? 'FORMULA' : (dbComp.calculationType || selected.calculationType),
                            percentage: dbComp.percentage || selected.percentage,
                            amount: dbComp.amount || selected.amount,
                            formula: selected.formula || dbComp.formula,
                            formulaFrequency: selected.formulaFrequency || dbComp.formulaFrequency || 'MONTHLY',
                            basedOn: selected.basedOn || dbComp.calculationBase || selected.calculationBase || selected.basedOn,
                            isManual: selected.isManual !== undefined ? !!selected.isManual : !!dbComp.isManual,
                            // Priority: if it's manual, use the provided value/monthly (direct UI override)
                            value: !!selected.isManual 
                                ? (selected.monthly !== undefined ? selected.monthly : selected.value) 
                                : (
                                    (dbComp.calculationType || selected.calculationType || '').toUpperCase().includes('PERCENT')
                                        ? (dbComp.percentage ?? dbComp.amount ?? selected.value ?? 0)
                                        : (dbComp.amount ?? dbComp.percentage ?? selected.value ?? 0)
                                  )
                        };
                    }

                    console.warn(`[SALARY_CONTROLLER] No DB config found for ${selected.name}, using selected data`);
                    return selected;
                });
            };

            // Merge selected components with actual DB configurations
            const mergedEarnings = selectedEarnings ? mergeWithDB(selectedEarnings, dbEarnings) : dbEarnings;
            const mergedDeductions = selectedDeductions ? mergeWithDB(selectedDeductions, dbDeductions) : dbDeductions;
            const mergedBenefits = selectedBenefits ? mergeWithDB(selectedBenefits, dbBenefits) : dbBenefits;
            const resolvedPayrollContext = await buildPayrollContext(
                req,
                locationContext || payrollContext?.locationContext || {},
                { applyStatutory: payrollContext?.applyStatutory !== false }
            );

            const result = SalaryCalculationEngine.calculateSalary({
                annualCTC,
                earnings: mergedEarnings,
                deductions: mergedDeductions,
                benefits: mergedBenefits,
                payrollContext: resolvedPayrollContext
            });
            console.log(`[SALARY_CONTROLLER] Preview Totals:`, result.totals);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('[SALARY_CONTROLLER] Preview Error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    },

    /**
     * Get Current
     */
    async getCurrent(req, res) {
        try {
            const { applicantId, employeeId } = req.query;
            // console.log(`[SALARY_CONTROLLER] getCurrent called: applicantId=${applicantId}, employeeId=${employeeId}`);

            if (!req.tenantDB) {
                console.error('[SALARY_CONTROLLER] tenantDB missing in request');
                return res.status(400).json({ success: false, message: "Tenant database not resolved" });
            }

            const Snapshot = req.tenantDB.model('EmployeeSalarySnapshot');
            let snapshot = null;

            // CONTEXT RESOLUTION STRATEGY
            if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
                // console.log(`[SALARY_CONTROLLER] Resolving by employee: ${employeeId}`);
                // 1. Direct link on snapshot
                snapshot = await Snapshot.findOne({ employee: employeeId }).sort({ createdAt: -1 });

                // 2. Fallback: Find Employee and check their direct snapshot link
                if (!snapshot) {
                    const Employee = req.tenantDB.model('Employee');
                    const empRec = await Employee.findById(employeeId);
                    if (empRec && (empRec.currentSalarySnapshotId || empRec.currentSnapshotId)) {
                        snapshot = await Snapshot.findById(empRec.currentSalarySnapshotId || empRec.currentSnapshotId);
                    }

                    // 3. Fallback: Find Applicant document linked to this employee
                    if (!snapshot) {
                        const Applicant = req.tenantDB.model('Applicant');
                        const appRec = await Applicant.findOne({ employeeId: employeeId });
                        if (appRec) {
                            // console.log(`[SALARY_CONTROLLER] Found linked applicant: ${appRec._id}`);
                            snapshot = await Snapshot.findOne({
                                $or: [{ applicant: appRec._id }, { _id: appRec.salarySnapshotId }]
                            }).sort({ createdAt: -1 });
                        }
                    }
                }
            } else if (applicantId && mongoose.Types.ObjectId.isValid(applicantId)) {
                // console.log(`[SALARY_CONTROLLER] Resolving by applicant: ${applicantId}`);
                // 1. Direct link on snapshot
                snapshot = await Snapshot.findOne({ applicant: applicantId }).sort({ createdAt: -1 });

                // 2. Fallback: Check if applicant exists in either Applicant or Application collection
                if (!snapshot) {
                    const ApplicantModel = req.tenantDB.model('Applicant');
                    const ApplicationModel = req.tenantDB.models?.Application || req.tenantDB.model('Application', require('../models/Application'));

                    let appRec = await ApplicantModel.findById(applicantId);
                    if (!appRec) appRec = await ApplicationModel.findById(applicantId);

                    if (appRec) {
                        if (appRec.salarySnapshotId) {
                            snapshot = await Snapshot.findById(appRec.salarySnapshotId);
                        }
                        // 3. Fallback: If applicant already hired, check if snapshot linked to their employee ID
                        if (!snapshot && appRec.employeeId) {
                            snapshot = await Snapshot.findOne({ employee: appRec.employeeId }).sort({ createdAt: -1 });
                        }
                    }
                }
            }

            if (snapshot) {
                // console.log(`[SALARY_CONTROLLER] Snapshot found via robust resolution. Data keys: ${Object.keys(snapshot.toObject ? snapshot.toObject() : snapshot)}`);
                const contract = mapToContract(snapshot);
                return res.json({ success: true, data: contract, source: 'SNAPSHOT' });
            }

            // console.log(`[SALARY_CONTROLLER] No snapshot found, returning default zero-CTC calculation`);
            const result = SalaryCalculationEngine.calculateSalary({ annualCTC: 0 });
            res.json({ success: true, data: result, source: 'DEFAULT' });
        } catch (error) {
            console.error('[SALARY_CONTROLLER] getCurrent Fatal Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Get Specific Snapshot by ID
     */
    async getSnapshot(req, res) {
        try {
            const { id } = req.params;
            if (!req.tenantDB) {
                return res.status(400).json({ success: false, message: "Tenant database not resolved" });
            }

            const Snapshot = req.tenantDB.model('EmployeeSalarySnapshot');
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, message: "Invalid Snapshot ID" });
            }

            const snapshot = await Snapshot.findById(id);

            if (!snapshot) {
                return res.status(404).json({ success: false, message: "Snapshot not found" });
            }

            return res.json({ success: true, data: mapToContract(snapshot), source: 'SNAPSHOT_ID' });

        } catch (error) {
            console.error('[SALARY_CONTROLLER] getSnapshot Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Assign (Save Draft)
     */
    async assign(req, res) {
        try {
            const { applicantId, employeeId, annualCTC, earnings, deductions, benefits, locationContext, payrollContext, effectiveFrom } = req.body;
            const Snapshot = req.tenantDB.model('EmployeeSalarySnapshot');
            const resolvedPayrollContext = await buildPayrollContext(
                req,
                locationContext || payrollContext?.locationContext || {},
                { applyStatutory: payrollContext?.applyStatutory !== false }
            );

            // 1. Strict Recalculation
            const result = SalaryCalculationEngine.calculateSalary({
                annualCTC,
                earnings,
                deductions,
                benefits,
                payrollContext: resolvedPayrollContext
            });

            // 2. Transact: Remove old drafts, create new
            const query = applicantId ? { applicant: applicantId } : { employee: employeeId };
            await Snapshot.deleteMany({ ...query, locked: false });

            const payload = mapToSnapshot(result, req, {
                applicant: applicantId || null,
                employee: employeeId || null,
                effectiveFrom: effectiveFrom || resolvedPayrollContext.locationContext?.effectiveFrom,
                payrollContext: resolvedPayrollContext
            });

            const snapshot = await Snapshot.create(payload);

            // 3. Link to target
            const ApplicantModel = req.tenantDB.model('Applicant');
            const ApplicationModel = req.tenantDB.models?.Application || req.tenantDB.model('Application', require('../models/Application'));
            const EmployeeModel = req.tenantDB.model('Employee');

            if (applicantId) {
                // Update in both potential collections for robustness
                await Promise.all([
                    ApplicantModel.findByIdAndUpdate(applicantId, {
                        $set: { salaryAssigned: true, salaryLocked: false, salarySnapshotId: snapshot._id }
                    }),
                    ApplicationModel.findByIdAndUpdate(applicantId, {
                        $set: { salaryAssigned: true, salaryLocked: false, salarySnapshotId: snapshot._id }
                    })
                ]);
            } else if (employeeId) {
                await EmployeeModel.findByIdAndUpdate(employeeId, {
                    $set: { salaryAssigned: true, salaryLocked: false, salarySnapshotId: snapshot._id }
                });
            }

            res.json({ success: true, message: "Draft saved", data: mapToContract(snapshot) });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Finalize & Lock
     */
    async confirm(req, res) {
        try {
            const { applicantId, employeeId } = req.body;
            const Snapshot = req.tenantDB.model('EmployeeSalarySnapshot');
            const query = applicantId ? { applicant: applicantId } : { employee: employeeId };

            const snapshot = await Snapshot.findOne(query).sort({ createdAt: -1 });
            if (!snapshot) throw new Error("No draft found");

            // Final Cross Check: Sum of components must match CTC exactly
            const totalComps = snapshot.earnings.reduce((s, e) => s + e.yearlyAmount, 0) +
                snapshot.benefits.reduce((s, b) => s + b.yearlyAmount, 0);

            if (Math.abs(totalComps - snapshot.ctc) > 1) { // 1 rupee tolerance for rounding
                throw new Error("CTC Mismatch. Please recalculate and save draft again.");
            }

            snapshot.locked = true;
            snapshot.lockedAt = new Date();
            await snapshot.save();

            const ApplicantModel = req.tenantDB.model('Applicant');
            const ApplicationModel = req.tenantDB.models?.Application || req.tenantDB.model('Application', require('../models/Application'));
            const EmployeeModel = req.tenantDB.model('Employee');

            if (applicantId) {
                await Promise.all([
                    ApplicantModel.findByIdAndUpdate(applicantId, { $set: { salaryLocked: true } }),
                    ApplicationModel.findByIdAndUpdate(applicantId, { $set: { salaryLocked: true } })
                ]);
            } else if (employeeId) {
                await EmployeeModel.findByIdAndUpdate(employeeId, { $set: { salaryLocked: true } });
            }

            let canonicalSync = null;
            const resolvedEmployeeId = employeeId || snapshot.employee;
            if (resolvedEmployeeId) {
                try {
                    canonicalSync = await salarySnapshotCanonicalSync.syncCanonicalPayrollFromSnapshot(
                        req.tenantDB,
                        getTenantId(req),
                        resolvedEmployeeId,
                        snapshot,
                        req.user?._id || req.user?.id || null,
                        {
                            effectiveFrom: snapshot.effectiveFrom,
                            reason: 'Finalized salary structure'
                        }
                    );
                } catch (syncError) {
                    console.error('[SALARY_CONTROLLER] Canonical sync warning:', syncError);
                    canonicalSync = {
                        skipped: true,
                        reason: 'CANONICAL_SYNC_FAILED',
                        message: syncError.message
                    };
                }
            }

            res.json({ success: true, message: "Finalized", data: mapToContract(snapshot), canonicalSync });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    /**
     * Unlock
     */
    async unlock(req, res) {
        try {
            const { applicantId, employeeId } = req.body;
            const Snapshot = req.tenantDB.model('EmployeeSalarySnapshot');
            const ApplicantModel = req.tenantDB.model('Applicant');
            const ApplicationModel = req.tenantDB.models?.Application || req.tenantDB.model('Application', require('../models/Application'));
            const EmployeeModel = req.tenantDB.model('Employee');

            const query = applicantId ? { applicant: applicantId } : { employee: employeeId };
            await Snapshot.updateMany(query, { $set: { locked: false } });

            if (applicantId) {
                await Promise.all([
                    ApplicantModel.findByIdAndUpdate(applicantId, { $set: { salaryLocked: false } }),
                    ApplicationModel.findByIdAndUpdate(applicantId, { $set: { salaryLocked: false } })
                ]);
            } else if (employeeId) {
                await EmployeeModel.findByIdAndUpdate(employeeId, { $set: { salaryLocked: false } });
            }

            res.json({ success: true, message: "Unlocked" });
        } catch (error) {
            res.status(500).json({ success: false, message: "Unlock failed" });
        }
    },

    /**
     * Auto Balance Salary Structure (Logic migrated from Frontend for security)
     */
    async autoBalance(req, res) {
        try {
            const { annualCTC, selectedEarnings, selectedDeductions, selectedBenefits, locationContext, payrollContext } = req.body;
            const ctc = parseFloat(annualCTC) || 0;
            if (ctc <= 0) return res.status(400).json({ success: false, message: "Invalid CTC" });
            const resolvedPayrollContext = await buildPayrollContext(
                req,
                locationContext || payrollContext?.locationContext || {},
                { applyStatutory: payrollContext?.applyStatutory !== false }
            );

            // Helper to derive code (same as frontend for consistency)
            const deriveCode = (c) => {
                if (!c) return '';
                if (c.code) return c.code.toUpperCase().trim();
                return (c.name || '').toUpperCase().trim().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            };

            const basicAnnual = ctc * 0.40;
            let used = basicAnnual;

            const otherEarnings = (selectedEarnings || []).filter(e => {
                const code = deriveCode(e);
                return !['BASIC', 'SPECIAL_ALLOWANCE', 'HOUSE_RENT_ALLOWANCE'].includes(code);
            });

            const calculateCost = (list) => {
                return list.reduce((sum, c) => {
                    const code = deriveCode(c);
                    if (code === 'SPECIAL_ALLOWANCE') return sum;
                    if (code === 'PROFESSIONAL_TAX') return sum + 2400;
                    if (['EMPLOYER_PF', 'EMPLOYEE_PF', 'PF'].includes(code)) return sum + (basicAnnual * 0.12);
                    if (code === 'GRATUITY') return sum + (basicAnnual * 0.0481);

                    const val = parseFloat(c.value || c.amount || 0);
                    const type = (c.calculationType || 'FIXED').toUpperCase();
                    if (type.includes('PERCENT')) {
                        const base = (c.basedOn || 'NA').toUpperCase();
                        return sum + (base === 'BASIC' ? (basicAnnual * val / 100) : (ctc * val / 100));
                    }
                    return sum + (val * 12);
                }, 0);
            };

            used += calculateCost(otherEarnings);
            used += calculateCost(selectedDeductions || []);
            used += calculateCost(selectedBenefits || []);

            const remaining = ctc - used;
            if (remaining < 0) {
                return res.status(400).json({ success: false, message: `Fixed Allocations (${used}) exceed CTC (${ctc}).` });
            }

            const hraIdx = (selectedEarnings || []).findIndex(e => deriveCode(e) === 'HOUSE_RENT_ALLOWANCE');
            let updatedEarnings = [...(selectedEarnings || [])];

            if (hraIdx !== -1) {
                const hraPct = safeNum(resolvedPayrollContext.locationPolicy?.hra?.percentageOfBasic || 50) / 100;
                const maxHRA = basicAnnual * hraPct;
                let newHRAValue = remaining - 1200; // Buffer for SA
                if (newHRAValue > maxHRA) newHRAValue = maxHRA;
                if (newHRAValue < 0) newHRAValue = 0;

                updatedEarnings[hraIdx] = {
                    ...updatedEarnings[hraIdx],
                    calculationType: 'FIXED',
                    value: newHRAValue / 12,
                    amount: newHRAValue / 12,
                    monthly: newHRAValue / 12,
                    yearly: newHRAValue
                };
            }

            // Finally, run through the standard calculation engine to get totals
            const finalResult = SalaryCalculationEngine.calculateSalary({
                annualCTC: ctc,
                earnings: updatedEarnings,
                deductions: selectedDeductions,
                benefits: selectedBenefits,
                payrollContext: resolvedPayrollContext
            });

            res.json({ success: true, data: finalResult });
        } catch (error) {
            console.error('[SALARY_CONTROLLER] autoBalance Error:', error);
            res.status(500).json({ success: false, message: "Auto-Balance logic failed on server" });
        }
    }
};

module.exports = SalaryController;
