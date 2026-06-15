const mongoose = require('mongoose');

function normalizeSmtpConfig(input = {}, existing = {}) {
    const incomingPass = input.pass || input.password;
    const pass = incomingPass && incomingPass !== '********' ? incomingPass : existing.pass || '';

    const port = Number(input.port || 587);
    let secure = input.secure === true || String(input.secure).toLowerCase() === 'true';
    if (port === 465) secure = true;
    else if (port === 587) secure = false;

    return {
        host: String(input.host || '').trim(),
        port,
        secure,
        user: String(input.user || '').trim(),
        pass,
        fromEmail: String(input.fromEmail || input.user || '').trim(),
        fromName: String(input.fromName || '').trim()
    };
}

function redactSmtpConfig(config = {}) {
    const smtpConfig = typeof config.toObject === 'function' ? config.toObject() : { ...config };
    if (smtpConfig.pass) {
        smtpConfig.pass = '********';
    }
    return smtpConfig;
}

exports.getTemplates = async (req, res) => {
    try {
        const EmailTemplate = mongoose.model('EmailTemplate');
        const tenantId = req.tenantId || req.user?.tenantId;
        const templates = await EmailTemplate.find({ tenantId });
        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
    }
};

exports.getTemplateById = async (req, res) => {
    try {
        const EmailTemplate = mongoose.model('EmailTemplate');
        const tenantId = req.tenantId || req.user?.tenantId;
        const template = await EmailTemplate.findOne({ _id: req.params.id, tenantId });
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, template });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch template', error: error.message });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const EmailTemplate = mongoose.model('EmailTemplate');
        const tenantId = req.tenantId || req.user?.tenantId;
        const template = new EmailTemplate({
            ...req.body,
            tenantId,
            createdBy: req.user?._id
        });
        await template.save();
        res.status(201).json({ success: true, message: 'Template created', template });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ success: false, message: 'Failed to create template', error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const EmailTemplate = mongoose.model('EmailTemplate');
        const tenantId = req.tenantId || req.user?.tenantId;
        const template = await EmailTemplate.findOneAndUpdate(
            { _id: req.params.id, tenantId },
            { ...req.body, updatedBy: req.user?._id },
            { new: true, runValidators: true }
        );
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, message: 'Template updated', template });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const EmailTemplate = mongoose.model('EmailTemplate');
        const tenantId = req.tenantId || req.user?.tenantId;
        const template = await EmailTemplate.findOneAndDelete({ _id: req.params.id, tenantId });
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, message: 'Failed to delete template', error: error.message });
    }
};

exports.getSmtpConfig = async (req, res) => {
    try {
        const Tenant = mongoose.model('Tenant');
        const tenantId = req.tenantId || req.user?.tenantId;
        const query = mongoose.Types.ObjectId.isValid(tenantId) ? { _id: tenantId } : { tenantId };
        const company = await Tenant.findOne(query);
        
        let smtpConfig = {};
        if (company && company.smtpConfig) {
             smtpConfig = redactSmtpConfig(company.smtpConfig);
        }
        
        res.json({ success: true, smtpConfig });
    } catch (error) {
        console.error('Error fetching SMTP config:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SMTP config', error: error.message });
    }
};

exports.updateSmtpConfig = async (req, res) => {
    try {
        const Tenant = mongoose.model('Tenant');
        const tenantId = req.tenantId || req.user?.tenantId;
        const query = mongoose.Types.ObjectId.isValid(tenantId) ? { _id: tenantId } : { tenantId };
        
        let company = await Tenant.findOne(query);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Tenant company profile not found.' });
        }

        company.smtpConfig = normalizeSmtpConfig(req.body, company.smtpConfig);
        await company.save();
        
        res.json({ success: true, message: 'SMTP config updated', smtpConfig: redactSmtpConfig(company.smtpConfig) });
    } catch (error) {
        console.error('Error updating SMTP config:', error);
        res.status(500).json({ success: false, message: 'Failed to update SMTP config', error: error.message });
    }
};
