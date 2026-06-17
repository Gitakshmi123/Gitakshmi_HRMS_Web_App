const Handlebars = require('handlebars');
const mongoose = require('mongoose');
const emailService = require('./email.service');

/**
 * Replace placeholders in a string using Handlebars
 */
function parseTemplate(templateString, data) {
    if (!templateString) return '';
    try {
        const template = Handlebars.compile(templateString);
        return template(data);
    } catch (err) {
        console.error('[TemplateService] Parsing Error:', err);
        return templateString;
    }
}

/**
 * Fetch and parse an EmailTemplate, then send it.
 * @param {ObjectId} tenantId 
 * @param {String} triggerType e.g., 'OFFER_LETTER'
 * @param {Object} contextData The data to populate placeholders (e.g. { candidate_name: "John Doe" })
 * @param {String} toEmail The recipient's email
 */
async function sendTemplatedEmail(tenantId, triggerType, contextData, toEmail) {
    try {
        // Find the active template for this trigger
        const EmailTemplate = mongoose.model('EmailTemplate');
        const templateDoc = await EmailTemplate.findOne({ tenantId, triggerType, isActive: true }).lean();
        
        if (!templateDoc) {
            console.warn(`[TemplateService] No active template found for trigger: ${triggerType}`);
            return false;
        }

        // Parse subject and body
        const parsedSubject = parseTemplate(templateDoc.subject, contextData);
        const parsedBodyHtml = parseTemplate(templateDoc.bodyHtml, contextData);

        // Fetch tenant SMTP config if available
        const Tenant = mongoose.model('Tenant');
        const tenantQuery = mongoose.Types.ObjectId.isValid(tenantId) ? { _id: tenantId } : { tenantId };
        const tenant = await Tenant.findOne(tenantQuery).lean();
        let customSmtp = null;
        if (tenant && tenant.smtpConfig && tenant.smtpConfig.host && tenant.smtpConfig.user && (tenant.smtpConfig.pass || tenant.smtpConfig.password)) {
            customSmtp = tenant.smtpConfig;
        }

        // Send email (assuming emailService has a generic sendMail function that accepts customSmtp)
        // We will pass customSmtp if it exists, otherwise it will use default platform SMTP
        await emailService.sendMail({
            to: toEmail,
            subject: parsedSubject,
            html: parsedBodyHtml,
            customSmtp,
            tenantId
        });

        return true;
    } catch (err) {
        console.error('[TemplateService] sendTemplatedEmail Error:', err);
        throw err;
    }
}

module.exports = {
    parseTemplate,
    sendTemplatedEmail
};
