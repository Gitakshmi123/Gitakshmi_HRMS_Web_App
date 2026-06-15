const getModels = (req) => {
    if (!req.tenantDB) throw new Error('Tenant DB connection not available');
    const BenefitComponent = req.tenantDB.model('BenefitComponent');
    if (!BenefitComponent) throw new Error('BenefitComponent model not registered');
    return { BenefitComponent };
};

const handleError = (res, error, message) => {
    console.error(`[BENEFIT ERROR] ${message}:`, error);

    // Mongoose validation errors
    if (error && error.name === 'ValidationError') {
        const messages = Object.values(error.errors || {}).map(e => e.message);
        return res.status(400).json({ success: false, error: messages.join(', ') });
    }

    // Duplicate key error
    if (error && error.code === 11000) {
        return res.status(400).json({ success: false, error: 'A benefit with this name or code already exists' });
    }

    res.status(500).json({ success: false, error: message || 'Internal Server Error' });
};

// CREATE BENEFIT
exports.createBenefit = async (req, res) => {
    try {
        // console.log('[BENEFIT] createBenefit called with body:', req.body);
        const { BenefitComponent } = getModels(req);
        const tenantId = req.user?.tenantId || req.tenantId;

        if (!tenantId) return res.status(401).json({ success: false, error: 'Unauthorized: No tenant context' });

        const {
            name,
            benefitType,
            payType,
            calculationType,
            value,
            code,
            partOfSalaryStructure,
            isTaxable,
            proRata,
            considerForEPF,
            considerForESI,
            showInPayslip,
            isActive
        } = req.body;

        // HARD VALIDATION
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Benefit name is required' });
        }
        if (!benefitType) {
            return res.status(400).json({ success: false, error: 'Benefit type is required' });
        }
        if (!calculationType) {
            return res.status(400).json({ success: false, error: 'Calculation type is required' });
        }
        if (value === undefined || value === null || isNaN(Number(value))) {
            return res.status(400).json({ success: false, error: 'Valid value is required' });
        }

        // Auto-generate code if missing
        const finalCode = code && code.trim()
            ? code.trim().toUpperCase()
            : name.trim().toUpperCase().replace(/\s+/g, "_");

        const newBenefit = new BenefitComponent({
            tenantId,
            name: name.trim(),
            benefitType,
            code: finalCode,
            payType: payType || 'FIXED',
            calculationType,
            value: Number(value),
            partOfSalaryStructure: partOfSalaryStructure !== false,
            isTaxable: !!isTaxable,
            proRata: !!proRata,
            considerForEPF: !!considerForEPF,
            considerForESI: !!considerForESI,
            showInPayslip: !!showInPayslip,
            isActive: isActive !== false
        });

        await newBenefit.save();
        // console.log('[BENEFIT] Created successfully:', newBenefit._id);

        return res.status(201).json({
            success: true,
            data: newBenefit,
            message: 'Benefit created successfully'
        });

    } catch (err) {
        return handleError(res, err, 'Failed to create benefit');
    }
};

// GET ALL BENEFITS
exports.getBenefits = async (req, res) => {
    try {
        const { BenefitComponent } = getModels(req);
        const tenantId = req.user?.tenantId || req.tenantId;
        const list = await BenefitComponent.find({ tenantId }).sort({ createdAt: -1 });
        res.json({ success: true, data: list });
    } catch (err) {
        handleError(res, err, 'Failed to fetch benefits');
    }
};

// GET BY ID
exports.getBenefitById = async (req, res) => {
    try {
        const { BenefitComponent } = getModels(req);
        const { id } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId;

        const doc = await BenefitComponent.findOne({ _id: id, tenantId });
        if (!doc) return res.status(404).json({ success: false, error: 'Benefit not found' });

        res.json({ success: true, data: doc });
    } catch (err) {
        handleError(res, err, 'Failed to fetch benefit details');
    }
};

// UPDATE BENEFIT
exports.updateBenefit = async (req, res) => {
    try {
        const { BenefitComponent } = getModels(req);
        const { id } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId;
        const updates = req.body;

        if (updates.value !== undefined) updates.value = Number(updates.value);

        const doc = await BenefitComponent.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!doc) return res.status(404).json({ success: false, error: 'Benefit not found' });

        res.json({ success: true, data: doc });
    } catch (err) {
        handleError(res, err, 'Failed to update benefit');
    }
};

// DELETE BENEFIT (HARD DELETE as per "behave exactly like Earnings" might imply, but usually soft delete is safer. Earnings controller used deleteOne. I will follow that.)
exports.deleteBenefit = async (req, res) => {
    try {
        const { BenefitComponent } = getModels(req);
        const { id } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId;

        const result = await BenefitComponent.deleteOne({ _id: id, tenantId });
        if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Benefit not found' });

        res.json({ success: true, message: 'Benefit deleted successfully' });
    } catch (err) {
        handleError(res, err, 'Failed to delete benefit');
    }
};

// TOGGLE STATUS
exports.toggleStatus = async (req, res) => {
    try {
        const { BenefitComponent } = getModels(req);
        const { id } = req.params;
        const { isActive } = req.body;
        const tenantId = req.user?.tenantId || req.tenantId;

        const doc = await BenefitComponent.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { isActive: !!isActive } },
            { new: true }
        );

        if (!doc) return res.status(404).json({ success: false, error: 'Benefit not found' });

        res.json({ success: true, data: doc });
    } catch (err) {
        handleError(res, err, 'Failed to toggle status');
    }
};
