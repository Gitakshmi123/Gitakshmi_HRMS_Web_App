const mongoose = require('mongoose');
const DynamicPayrollEngine = require('../services/DynamicPayrollEngine');
// ✅ GLOBAL SalaryStructure model (single collection)
const SalaryStructure = mongoose.models.SalaryStructure || mongoose.model('SalaryStructure', require('../models/SalaryStructure'));

// Helper to get tenant models
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    return {
        Applicant: db.models.Applicant || db.model("Applicant", require('../models/Applicant')),
        SalaryStructure: db.models.SalaryStructure || db.model("SalaryStructure", require('../models/SalaryStructure')),
        SalaryComponent: db.models.SalaryComponent || db.model("SalaryComponent", require('../models/SalaryComponent')),
        DeductionMaster: db.models.DeductionMaster || db.model("DeductionMaster", require('../models/DeductionMaster')),
        BenefitComponent: db.models.BenefitComponent || db.model("BenefitComponent", require('../models/BenefitComponent')),
        MinimumWage: db.models.MinimumWage || db.model("MinimumWage", require('../models/MinimumWage'))
    };
}

/**
 * @route POST /api/salary-structure/suggest
 * @desc Suggest salary structure based on CTC
 */
exports.suggestSalaryStructure = async (req, res) => {
    try {
        const { enteredCTC } = req.body;
        if (!enteredCTC) return res.status(400).json({ message: "Entered CTC is required" });

        const tenantId = req.user?.tenant || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: "Tenant ID missing in user context" });
        }

        const { SalaryComponent, DeductionMaster, BenefitComponent } = getModels(req);

        // Fetch active components from database
        const [earnings, deductions, benefits] = await Promise.all([
            SalaryComponent.find({ tenantId, type: 'EARNING', isActive: true }).lean(),
            DeductionMaster.find({ tenantId, isActive: true }).lean(),
            BenefitComponent.find({ tenantId, isActive: true }).lean()
        ]);

        // 🔍 DEBUG: Log fetched components
        // console.log('🔍 DEBUG: Fetched Earnings Components:', JSON.stringify(earnings.map(e => ({
        //     name: e.name,
        //     calculationType: e.calculationType,
        //     percentage: e.percentage,
        //     amount: e.amount
        // })), null, 2));

        const engine = new DynamicPayrollEngine(req.tenantDB);
        const suggestion = await engine.generateBreakup({
            tenantId,
            enteredCTC: Number(enteredCTC),
            availableEarnings: earnings,
            availableDeductions: deductions,
            availableBenefits: benefits,
            state: req.body.state,
            jobCategory: req.body.jobCategory
        });

        res.json({
            success: true,
            data: suggestion
        });
    } catch (error) {
        console.error("Suggest Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * @route POST /api/salary-structure/create
 * @desc Create or Update Salary Structure (GLOBAL collection, tenant-safe)
 */
exports.createSalaryStructure = async (req, res) => {
    try {
        const {
            candidateId,
            calculationMode,
            enteredCTC,
            earnings,
            deductions,
            employerContributions
        } = req.body;

        if (!candidateId) {
            return res.status(400).json({ message: "Candidate ID is required" });
        }

        if (!enteredCTC || isNaN(Number(enteredCTC))) {
            return res.status(400).json({ message: "Annual CTC is required and must be numeric" });
        }

        const tenantId = req.user?.tenant || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ message: "Tenant ID missing in user context" });
        }

        const { Applicant, SalaryStructure } = getModels(req);

        const engine = new DynamicPayrollEngine(req.tenantDB);
        
        // Convert input formats to manual overrides map if calculationMode is MANUAL
        let manualOverrides = {};
        if (calculationMode === 'MANUAL') {
            [...(earnings || []), ...(deductions || []), ...(employerContributions || [])].forEach(item => {
                const id = item.componentId || item._id || item.key;
                if (id) manualOverrides[id] = Number(item.amount || item.monthly || 0);
            });
        }

        // Fetch components since engine needs the DB records to evaluate formulas
        const { SalaryComponent, DeductionMaster, BenefitComponent } = getModels(req);
        const [dbEarnings, dbDeductions, dbBenefits] = await Promise.all([
            SalaryComponent.find({ tenantId, type: 'EARNING', isActive: true }).lean(),
            DeductionMaster.find({ tenantId, isActive: true }).lean(),
            BenefitComponent.find({ tenantId, isActive: true }).lean()
        ]);

        // 🔢 Salary Calculation (single source of truth)
        const result = await engine.generateBreakup({
            tenantId,
            enteredCTC: Number(enteredCTC),
            availableEarnings: dbEarnings,
            availableDeductions: dbDeductions,
            availableBenefits: dbBenefits,
            manualOverrides
        });

        // ❌ Block invalid AUTO calculation
        if (calculationMode === 'AUTO' && !result.isValid) {
            return res.status(400).json({
                error: "CTC_MISMATCH",
                message: `Calculated CTC (₹${result.receivedCTC}) does not match Entered CTC (₹${result.expectedCTC})`,
                mismatchAmount: result.mismatchAmount
            });
        }

        // 🧱 Persist into ONE global collection
        const structureData = {
            tenantId,
            candidateId,
            calculationMode: calculationMode || 'AUTO',

            earnings: result.earnings.map(e => ({
                key: e.componentId || e._id,
                label: e.name,
                monthly: e.amount,
                yearly: e.amount * 12,
                type: 'earning'
            })),

            deductions: result.deductions.map(d => ({
                key: d.componentId || d._id,
                label: d.name,
                monthly: d.amount,
                yearly: d.amount * 12,
                type: 'deduction'
            })),

            employerBenefits: result.employerContributions.map(b => ({
                key: b.componentId || b._id,
                label: b.name,
                monthly: b.amount,
                yearly: b.amount * 12,
                type: 'employer_benefit'
            })),

            totals: {
                grossEarnings: result.monthly.grossEarnings,
                totalDeductions: result.monthly.totalDeductions,
                netSalary: result.monthly.netSalary,
                employerBenefits: result.monthly.employerContributions,
                monthlyCTC: Math.round(result.annual.ctc / 12),
                annualCTC: result.annual.ctc
            },

            validation: {
                isValid: result.isValid,
                mismatchAmount: result.mismatchAmount,
                validatedAt: new Date()
            },

            updatedBy: req.user?.name || 'System',
            updatedAt: new Date()
        };

        const savedStructure = await SalaryStructure.findOneAndUpdate(
            { tenantId, candidateId },
            { $set: structureData },
            { upsert: true, new: true }
        );

        // 🔄 Snapshot into Applicant (NO new collection)
        await Applicant.findByIdAndUpdate(candidateId, {
            $set: {
                ctc: result.receivedCTC,
                salaryStructureId: savedStructure._id,
                salarySnapshot: {
                    earnings: structureData.earnings,
                    deductions: structureData.deductions,
                    employerBenefits: structureData.employerBenefits,
                    totals: structureData.totals,
                    calculatedAt: new Date()
                }
            }
        });

        return res.json({
            success: true,
            message: "Salary structure saved successfully",
            data: savedStructure
        });

    } catch (err) {
        console.error("❌ Salary Structure Error:", err);
        return res.status(500).json({ message: err.message });
    }
};

/**
 * @route GET /api/salary-structure/:candidateId
 * @desc Fetch salary structure for candidate
 */
exports.getSalaryStructure = async (req, res) => {
    try {
        const { candidateId } = req.params;
        const tenantId = req.user?.tenant || req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({ message: "Tenant ID required" });
        }

        const { SalaryStructure } = getModels(req);
        const structure = await SalaryStructure.findOne({ tenantId, candidateId });

        if (!structure) {
            return res.status(404).json({ message: "Salary structure not found" });
        }

        return res.json(structure);

    } catch (err) {
        console.error("❌ Get Salary Structure Error:", err);
        return res.status(500).json({ message: err.message });
    }
};
