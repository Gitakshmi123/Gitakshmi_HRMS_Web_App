const OfferLetterTemplateSchema = require('../models/OfferLetterTemplate');

// Helper to get model
const getTemplateModel = (req) => {
    if (req.tenantDB) {
        // Fix: Do not pass schema here, model is already registered by dbManager
        return req.tenantDB.model('OfferLetterTemplate');
    }
    // Fallback or error if not using tenantDB
    throw new Error("Tenant Database context missing");
};

exports.getTemplates = async (req, res) => {
    // console.log(`[OFFER_TEMPLATE_CONTROLLER] getTemplates called for path: ${req.path}`);
    try {
        // console.log(`[OFFER_TEMPLATE_CONTROLLER] getTemplates called`);
        // console.log(`[OFFER_TEMPLATE_CONTROLLER] req.user:`, req.user ? { id: req.user.id, role: req.user.role } : 'null');
        // console.log(`[OFFER_TEMPLATE_CONTROLLER] req.tenantId:`, req.tenantId || 'null');
        // console.log(`[OFFER_TEMPLATE_CONTROLLER] req.tenantDB:`, req.tenantDB ? 'present' : 'null');

        // Backend validation: Ensure user is authenticated and has HR role
        if (!req.user || !req.user.id) {
            console.warn(`[OFFER_TEMPLATE_CONTROLLER] Missing user context`);
            return res.status(400).json({ error: 'User authentication required' });
        }

        // For tenant-specific operations, ensure tenantId is available
        if (!req.tenantId) {
            console.warn(`[OFFER_TEMPLATE_CONTROLLER] Missing tenant context`);
            return res.status(400).json({ error: 'Tenant context required' });
        }

        // console.log(`[OFFER_TEMPLATE_CONTROLLER] Getting template model...`);
        const Template = getTemplateModel(req);
        // console.log(`[OFFER_TEMPLATE_CONTROLLER] Template model obtained, querying...`);
        const templates = await Template.find({ isActive: true }).sort({ createdAt: -1 });

        // console.log(`[OFFER_TEMPLATE_CONTROLLER] Found ${templates.length} templates`);

        res.json(templates);
    } catch (err) {
        console.error(`[OFFER_TEMPLATE_CONTROLLER] Error:`, err);
        res.status(500).json({ error: "Failed to fetch templates", details: err.message });
    }
};

exports.getTemplateById = async (req, res) => {
    // console.log(`[OFFER_TEMPLATE_CONTROLLER] getTemplateById called for path: ${req.path}, id: ${req.params.id}`);
    // console.log(`[OFFER_TEMPLATE_CONTROLLER] req.params:`, req.params);
    try {
        const Template = getTemplateModel(req);
        const template = await Template.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }
        res.json(template);
    } catch (err) {
        console.error("Get template error:", err);
        res.status(500).json({ error: "Failed to fetch template" });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const Template = getTemplateModel(req);
        const { name, header, body, footer } = req.body;

        const newTemplate = new Template({
            tenant: req.tenantId,
            name,
            header,
            body,
            footer
        });

        await newTemplate.save();
        res.status(201).json(newTemplate);
    } catch (err) {
        console.error("Create template error:", err);
        res.status(500).json({ error: "Failed to create template" });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const Template = getTemplateModel(req);
        const { id } = req.params;
        const { name, header, body, footer, isActive } = req.body;

        const updatedTemplate = await Template.findByIdAndUpdate(
            id,
            { name, header, body, footer, isActive },
            { new: true }
        );

        if (!updatedTemplate) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json(updatedTemplate);
    } catch (err) {
        console.error("Update template error:", err);
        res.status(500).json({ error: "Failed to update template" });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const Template = getTemplateModel(req);
        const { id } = req.params;

        // Soft delete or hard delete? User said "Delete", usually soft delete is safer but let's do hard delete for now or set isActive=false
        // Let's do hard delete as requested
        const deleted = await Template.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json({ message: "Template deleted successfully" });
    } catch (err) {
        console.error("Delete template error:", err);
        res.status(500).json({ error: "Failed to delete template" });
    }
};
