const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    // Get company dem001
    const Tenant = mongoose.connection.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
    const tenant = await Tenant.findOne({ code: 'dem001' });
    if (!tenant) {
      console.error("Tenant dem001 not found");
      process.exit(1);
    }
    const tenantId = tenant._id;

    // Define EmailTemplate Schema/Model
    const EmailTemplateSchema = require('../models/EmailTemplate');
    const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', EmailTemplateSchema);

    // Remove existing test templates
    await EmailTemplate.deleteMany({ tenantId, name: /test offer/i });

    // Seed Template 1
    const tpl1 = new EmailTemplate({
      tenantId,
      name: 'Test Offer Template - Modern Sleek',
      module: 'Recruitment',
      triggerType: 'OFFER_LETTER_ISSUED',
      subject: 'Welcome Aboard! Official Offer Letter from {{companyName}}',
      bodyHtml: `
        <div style="font-family: 'Outfit', sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 30px; border-radius: 20px;">
          <div style="background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(10px); padding: 30px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.3); color: #1e293b;">
            <h2 style="margin-top: 0; color: #3b82f6;">Hello {{candidateName}}! 🎉</h2>
            <p>We are thrilled to extend this official offer for the position of <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
            <p>Our team was incredibly impressed by your background and passion, and we cannot wait to build the future of our company together.</p>
            <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 8px;">
              <strong>Joining Date:</strong> {{joiningDate}}<br/>
              <strong>Department:</strong> {{department}}<br/>
              <strong>Annual CTC:</strong> ₹{{ctcYearly}}
            </div>
            <p>Please find your detailed offer letter attached. Kindly review, sign, and return it at your earliest convenience.</p>
            <p style="margin-bottom: 0;">Warm regards,<br/><strong>The Talent Team at {{companyName}}</strong></p>
          </div>
        </div>
      `,
      isActive: true
    });

    // Seed Template 2
    const tpl2 = new EmailTemplate({
      tenantId,
      name: 'Test Offer Template - Professional Simple',
      module: 'Recruitment',
      triggerType: 'OFFER_LETTER_ISSUED',
      subject: 'Employment Offer Letter: {{jobTitle}} at {{companyName}}',
      bodyHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
          <p>Dear {{candidateName}},</p>
          <p>On behalf of <strong>{{companyName}}</strong>, I am pleased to offer you the position of <strong>{{jobTitle}}</strong> starting on <strong>{{joiningDate}}</strong>.</p>
          <p>Your annual salary for this position will be ₹<strong>{{ctcYearly}}</strong>, and you will report to the <strong>{{department}}</strong> department.</p>
          <p>Please review the terms and conditions outlined in the attached Offer Letter. To accept this offer, please sign and upload the document in the portal.</p>
          <p>If you have any questions, feel free to reach out to us.</p>
          <br/>
          <p>Best regards,<br/>Human Resources Department<br/>{{companyName}}</p>
        </div>
      `,
      isActive: true
    });

    await tpl1.save();
    await tpl2.save();
    console.log("Successfully seeded 2 test offer templates!");

  } catch (error) {
    console.error("Error during seeding:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
