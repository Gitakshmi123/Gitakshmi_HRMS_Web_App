const SocialTemplate = require('../models/social/SocialTemplate');

const getTemplates = async (req, res) => {
    try {
        const { category } = req.query;
        let query = { $or: [{ isPublic: true }] };
        
        if (req.user && req.user.tenantId) {
            query.$or.push({ companyId: req.user.tenantId });
        }

        if (category) query.category = category;

        const templates = await SocialTemplate.find(query).sort({ createdAt: -1 });
        return res.status(200).json(templates);
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

const saveTemplate = async (req, res) => {
    try {
        const { name, canvasData, thumbnail, category, isPublic } = req.body;
        
        const template = await SocialTemplate.create({
            name,
            canvasData,
            thumbnail,
            category: category || 'General',
            isPublic: isPublic !== undefined ? isPublic : false,
            companyId: req.user ? req.user.tenantId : null
        });

        return res.status(201).json({
            success: true,
            data: template,
            message: 'Template saved successfully'
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

const getTemplateById = async (req, res) => {
    try {
        const template = await SocialTemplate.findById(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found' });
        return res.status(200).json(template);
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    getTemplates,
    saveTemplate,
    getTemplateById
};
