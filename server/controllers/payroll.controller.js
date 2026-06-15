const fs = require('fs');

const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database connection not available. Please ensure tenant middleware is running.');
    }
    try {
        return {
            SalaryComponent: req.tenantDB.model('SalaryComponent')
        };
    } catch (err) {
        console.error('Error in getModels (payroll):', err);
        throw new Error('Failed to get payroll models from tenant database');
    }
};

const { seedDefaultComponents } = require('../services/payrollComponentSeeder');

// Admin-only: Seed default payroll components for the tenant. Idempotent.
exports.seedDefaultComponents = async (req, res) => {
    try {
        // Require admin role will be enforced by route middleware
        const tenantId = req.user?.tenantId || req.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized: Tenant context required' });
        if (!req.tenantDB) return res.status(500).json({ success: false, error: 'Tenant DB connection not available' });

        const results = await seedDefaultComponents(req.tenantDB, tenantId);
        return res.json({ success: true, results });
    } catch (err) {
        console.error('[SEED_DEFAULT_COMPONENTS] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

// Helper to handle errors
const handleError = (res, error, message) => {
    console.error(message, error);
    res.status(500).json({ success: false, error: message || 'Internal Server Error' });
};

// Create a new Earning Component
exports.createEarning = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            console.error("createEarning ERROR: Missing user or tenantId in request");
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantId = req.user.tenantId || req.tenantId;
        if (!tenantId) {
            console.error("createEarning ERROR: tenantId not available");
            return res.status(400).json({ success: false, error: "tenant_missing", message: "Tenant ID is required" });
        }

        // Ensure tenantDB is available
        if (!req.tenantDB) {
            console.error("createEarning ERROR: Tenant database connection not available");
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database connection not available" });
        }

        const { SalaryComponent } = getModels(req);
        const {
            earningType,
            name,
            payslipName,
            payType,
            calculationType,
            amount,
            percentage,
            isActive,
            enabled,
            isTaxable,
            isProRataBasis,
            includeInSalaryStructure,
            epf,
            esi,
            showInPayslip,
            formula,
            formulaFrequency
        } = req.body;

        // console.log('[createEarning] request body:', JSON.stringify(req.body));

        // Validate request
        const missing = [];
        if (!name || (typeof name === 'string' && !name.trim())) missing.push('name');
        if (!payslipName || (typeof payslipName === 'string' && !payslipName.trim())) missing.push('payslipName');
        if (missing.length) {
            return res.status(400).json({ success: false, error: 'Mandatory fields missing', missing });
        }

        if (calculationType === 'FLAT_AMOUNT' && (amount === undefined || amount === null)) {
            return res.status(400).json({ success: false, error: 'Amount is required for Flat Amount components' });
        }

        if (calculationType === 'PERCENTAGE_OF_BASIC' && (percentage === undefined || percentage === null)) {
            return res.status(400).json({ success: false, error: 'Percentage is required for basic-linked components' });
        }

        const newComponent = new SalaryComponent({
            tenantId: tenantId,
            type: 'EARNING',
            earningType,
            name,
            payslipName,
            payType,
            calculationType,
            amount: calculationType === 'FLAT_AMOUNT' ? amount : 0,
            // Accept both percentage-of-basic and percentage-of-ctc variants.
            percentage: (calculationType === 'PERCENTAGE_OF_BASIC' || calculationType === 'PERCENTAGE_OF_CTC') ? (typeof percentage === 'number' && !isNaN(percentage) ? percentage : (typeof amount === 'number' ? amount : 0)) : 0,
            isActive,
            enabled: enabled !== undefined ? enabled : true,
            isTaxable,
            isProRataBasis,
            includeInSalaryStructure,
            epf,
            esi,
            showInPayslip,
            formula,
            formulaFrequency
        });

        await newComponent.save();

        res.status(201).json({
            success: true,
            data: newComponent,
            message: 'Earning component created successfully'
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Component with this name already exists' });
        }
        handleError(res, error, 'Failed to create earning component');
    }
};

// Get all Earnings (Auto-Seed if empty)
exports.getEarnings = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            console.error("getEarnings ERROR: Missing user or tenantId in request");
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantId = req.user.tenantId || req.tenantId;

        // Ensure tenantDB is available
        if (!req.tenantDB) {
            console.error("getEarnings ERROR: Tenant database connection not available");
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database connection not available" });
        }

        const { SalaryComponent } = getModels(req);

        // Check if defaults exist
        // const count = await SalaryComponent.countDocuments({ tenantId: tenantId, type: 'EARNING' });

        // if (count === 0) {
        //     // console.log(`🌱 seeding default earnings for tenant ${tenantId}...`);
        //     const defaults = [
        //         { name: "Basic Salary", payslipName: "Basic", calculationType: 'PERCENTAGE_OF_BASIC', percentage: 50, isTaxable: true, isActive: true },
        //         { name: "House Rent Allowance", payslipName: "HRA", calculationType: 'PERCENTAGE_OF_BASIC', percentage: 20, isTaxable: true, isActive: true },
        //         { name: "Conveyance Allowance", payslipName: "Conveyance", calculationType: 'FLAT_AMOUNT', amount: 1600, isTaxable: false, isActive: true },
        //         { name: "Medical Allowance", payslipName: "Medical", calculationType: 'FLAT_AMOUNT', amount: 1250, isTaxable: false, isActive: true },
        //         { name: "Special Allowance", payslipName: "Special", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: true, isActive: true },

        //         // Requested Additions
        //         { name: "Medical Reimbursement", payslipName: "Med. Reimb.", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isActive: true },
        //         { name: "Transport Allowance", payslipName: "Transport", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: true, isActive: true },
        //         { name: "Education Allowance", payslipName: "Education", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isActive: true },
        //         { name: "Books & Periodicals", payslipName: "Books & Per.", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isActive: true },
        //         { name: "Uniform Allowance", payslipName: "Uniform", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isActive: true },
        //         { name: "Mobile Reimbursement", payslipName: "Mobile", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: false, isActive: true },
        //         { name: "Compensatory Allowance", payslipName: "Compensatory", calculationType: 'FLAT_AMOUNT', amount: 0, isTaxable: true, isActive: true }
        //     ];

        //     const docs = defaults.map(d => ({
        //         ...d,
        //         tenantId,
        //         type: 'EARNING',
        //         earningType: 'Fixed', // Default
        //         amount: d.amount || 0,
        //         percentage: d.percentage || 0
        //     }));

        //     await SalaryComponent.insertMany(docs);
        // }

        const earnings = await SalaryComponent.find({
            tenantId: tenantId,
            type: 'EARNING'
        }).sort({ createdAt: 1 }); // Sort by creation to keep Basic/HRA top

        res.json({ success: true, data: earnings });
    } catch (error) {
        console.error("getEarnings ERROR:", error);
        handleError(res, error, 'Failed to fetch earnings');
    }
};

// Update Earning
exports.updateEarning = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            console.error("updateEarning ERROR: Missing user or tenantId in request");
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantId = req.user.tenantId || req.tenantId;
        if (!tenantId) {
            console.error("updateEarning ERROR: tenantId not available");
            return res.status(400).json({ success: false, error: "tenant_missing", message: "Tenant ID is required" });
        }

        // Ensure tenantDB is available
        if (!req.tenantDB) {
            console.error("updateEarning ERROR: Tenant database connection not available");
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database connection not available" });
        }

        const { SalaryComponent } = getModels(req);
        const { id } = req.params;
        const updates = req.body;

        // fs.appendFileSync('debug_payroll.txt', `[UpdateEarning] ID: ${id}, Body: ${JSON.stringify(updates)}\n`);


        // Ensure tenant isolation - only find components belonging to this tenant
        const component = await SalaryComponent.findOne({ _id: id, tenantId: tenantId });
        if (!component) {
            return res.status(404).json({ success: false, error: 'Component not found' });
        }

        // Check Business Rule: If used in payroll, restricted editing
        if (component.isUsedInPayroll) {
            // Allow only display name changes and value changes + calc type correction
            const allowedKeys = ['name', 'payslipName', 'amount', 'percentage', 'isActive', 'calculationType', 'formula', 'formulaFrequency'];
            const filteredUpdates = {};

            Object.keys(updates).forEach(key => {
                if (allowedKeys.includes(key)) {
                    filteredUpdates[key] = updates[key];
                }
            });

            if (Object.keys(filteredUpdates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'This component is used in payrolls. Only Name, Payslip Name, and Amount can be edited.'
                });
            }

            Object.assign(component, filteredUpdates);
        } else {
            // Full update allowed
            Object.assign(component, updates);
        }

        await component.save();

        res.json({
            success: true,
            data: component,
            message: 'Component updated successfully'
        });

    } catch (error) {
        handleError(res, error, 'Failed to update earning');
    }
};

// Delete Earning
exports.deleteEarning = async (req, res) => {
    try {
        // Validate tenant context
        if (!req.user || !req.user.tenantId) {
            console.error("deleteEarning ERROR: Missing user or tenantId in request");
            return res.status(401).json({ success: false, error: "unauthorized", message: "User context or tenant not found" });
        }

        const tenantId = req.user.tenantId || req.tenantId;
        if (!tenantId) {
            console.error("deleteEarning ERROR: tenantId not available");
            return res.status(400).json({ success: false, error: "tenant_missing", message: "Tenant ID is required" });
        }

        // Ensure tenantDB is available
        if (!req.tenantDB) {
            console.error("deleteEarning ERROR: Tenant database connection not available");
            return res.status(500).json({ success: false, error: "tenant_db_unavailable", message: "Tenant database connection not available" });
        }

        const { SalaryComponent } = getModels(req);
        const { id } = req.params;

        // Ensure tenant isolation - only find components belonging to this tenant
        const component = await SalaryComponent.findOne({ _id: id, tenantId: tenantId });

        if (!component) {
            return res.status(404).json({ success: false, error: 'Component not found' });
        }

        // if (component.isUsedInPayroll) {
        //     return res.status(400).json({ success: false, error: 'Cannot delete component that has been used in payroll' });
        // }

        await component.deleteOne();

        res.json({ success: true, message: 'Component deleted successfully' });
    } catch (error) {
        handleError(res, error, 'Failed to delete component');
    }
};

exports.bulkCreateSalaryComponents = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized: Tenant context required' });
        if (!req.tenantDB) return res.status(500).json({ success: false, error: 'Tenant DB connection not available' });

        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, error: 'Invalid input: expected an array of items' });
        }

        const SalaryComponent = req.tenantDB.model('SalaryComponent');
        const BenefitComponent = req.tenantDB.model('BenefitComponent');
        const DeductionMaster = req.tenantDB.model('DeductionMaster');

        const results = {
            created: 0,
            skipped: 0,
            errors: []
        };

        for (const item of items) {
            try {
                const category = String(item.category || '').toUpperCase();

                if (category === 'EARNING' || category === 'CORRECTION') {
                    const existing = await SalaryComponent.findOne({ tenantId, name: item.name });
                    if (existing) {
                        results.skipped++;
                        continue;
                    }
                    const doc = new SalaryComponent({
                        ...item,
                        tenantId,
                        type: category
                    });
                    await doc.save();
                    results.created++;
                } else if (category === 'BENEFIT') {
                    const existing = await BenefitComponent.findOne({ tenantId, name: item.name });
                    if (existing) {
                        results.skipped++;
                        continue;
                    }
                    const finalCode = item.code && item.code.trim()
                        ? item.code.trim().toUpperCase()
                        : item.name.trim().toUpperCase().replace(/\s+/g, "_");

                    // Map EARNING format to BENEFIT format
                    let calcType = 'FLAT';
                    let val = item.amount || 0;
                    if (item.calculationType === 'PERCENTAGE_OF_BASIC') {
                        calcType = 'PERCENT_OF_BASIC';
                        val = item.percentage || 0;
                    } else if (item.calculationType === 'PERCENTAGE_OF_CTC') {
                        calcType = 'PERCENT_OF_CTC';
                        val = item.percentage || 0;
                    }

                    const doc = new BenefitComponent({
                        ...item,
                        code: finalCode,
                        tenantId,
                        calculationType: calcType,
                        value: val
                    });
                    await doc.save();
                    results.created++;
                } else if (category === 'DEDUCTION') {
                    const existing = await DeductionMaster.findOne({ tenantId, name: item.name });
                    if (existing) {
                        results.skipped++;
                        continue;
                    }

                    // Map EARNING format to DEDUCTION format
                    let amtType = 'FIXED';
                    let calcBase = 'BASIC';
                    let val = item.amount || 0;

                    if (item.calculationType === 'PERCENTAGE_OF_BASIC') {
                        amtType = 'PERCENTAGE';
                        calcBase = 'BASIC';
                        val = item.percentage || 0;
                    } else if (item.calculationType === 'PERCENTAGE_OF_CTC') {
                        amtType = 'PERCENTAGE';
                        calcBase = 'CTC';
                        val = item.percentage || 0;
                    }

                    // Default deduction categories
                    const deductCategory = (item.name || '').toLowerCase().includes('tax') ? 'PRE_TAX' : 'POST_TAX';
                    const statCat = (item.name || '').toLowerCase().includes('epf') || (item.name || '').toLowerCase().includes('provident') ? 'EPF' 
                                  : (item.name || '').toLowerCase().includes('esi') ? 'ESI'
                                  : (item.name || '').toLowerCase().includes('tax') ? 'PROFESSIONAL_TAX' : 'OTHER';

                    const doc = new DeductionMaster({
                        ...item,
                        tenantId,
                        amountType: amtType,
                        calculationBase: calcBase,
                        amountValue: val,
                        category: deductCategory,
                        statutoryCategory: statCat,
                        createdBy: req.user._id || req.user.id
                    });
                    await doc.save();
                    results.created++;
                } else {
                    results.errors.push(`Unknown category: ${category} for item ${item.name}`);
                }
            } catch (err) {
                results.errors.push(`Error saving ${item.name}: ${err.message}`);
            }
        }

        res.json({ success: true, results });
    } catch (err) {
        console.error('[BULK_CREATE_COMPONENTS] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
