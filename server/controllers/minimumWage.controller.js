const getModels = (req) => {
    if (!req.tenantDB) {
        throw new Error('Tenant database connection not available.');
    }
    // Safe model retrieval with fallback to registration
    const MinimumWage = req.tenantDB.models.MinimumWage || req.tenantDB.model('MinimumWage', require('../models/MinimumWage'));
    return { MinimumWage };
};

exports.getAll = async (req, res) => {
    try {
        const { MinimumWage } = getModels(req);
        const tenantId = req.user?.tenantId || req.tenantId || req.user?.tenant;
        const data = await MinimumWage.find({ tenantId }).sort({ state: 1, category: 1 });
        res.json({ success: true, data });
    } catch (err) {
        console.error('[MINIMUM_WAGE_CONTROLLER] getAll Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { MinimumWage } = getModels(req);
        const tenantId = req.user?.tenantId || req.tenantId || req.user?.tenant;
        const payload = { ...req.body, tenantId };
        
        // Normalize
        if (payload.state) payload.state = payload.state.toUpperCase();
        if (payload.category) payload.category = payload.category.toUpperCase();

        const doc = new MinimumWage(payload);
        await doc.save();
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        console.error('[MINIMUM_WAGE_CONTROLLER] create Error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, error: 'Minimum wage already exists for this state and category' });
        }
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { MinimumWage } = getModels(req);
        const { id } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId || req.user?.tenant;
        
        const doc = await MinimumWage.findOneAndUpdate(
            { _id: id, tenantId },
            req.body,
            { new: true }
        );
        
        if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        console.error('[MINIMUM_WAGE_CONTROLLER] update Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { MinimumWage } = getModels(req);
        const { id } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId || req.user?.tenant;
        
        const doc = await MinimumWage.findOneAndDelete({ _id: id, tenantId });
        if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        console.error('[MINIMUM_WAGE_CONTROLLER] delete Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
