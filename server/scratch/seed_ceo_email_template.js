const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Custom DNS Resolver to resolve SRV records manually (bypassing node DNS SRV lookup bugs)
async function resolveMongoUri(srvUri) {
  if (!srvUri.startsWith('mongodb+srv://')) {
    return srvUri;
  }
  
  return new Promise((resolve, reject) => {
    // Parse credentials and host
    const urlParts = srvUri.replace('mongodb+srv://', '').split('/');
    const credentialsAndHost = urlParts[0];
    const rest = urlParts.slice(1).join('/');
    
    const hostParts = credentialsAndHost.split('@');
    const credentials = hostParts.length > 1 ? hostParts[0] : '';
    const srvHost = hostParts.length > 1 ? hostParts[1] : hostParts[0];
    
    console.log(`Resolving SRV records for: ${srvHost}`);
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
    
    resolver.resolveSrv(`_mongodb._tcp.${srvHost}`, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.warn(`[WARNING] Custom DNS SRV resolution failed: ${err ? err.message : 'no addresses'}. Falling back to original URI.`);
        resolve(srvUri);
        return;
      }
      
      const directHosts = addresses.map(addr => `${addr.name}:${addr.port}`).join(',');
      const credentialsPrefix = credentials ? `${credentials}@` : '';
      
      // Determine query params (adding ssl=true)
      const separator = rest.includes('?') ? '&' : '?';
      const directUri = `mongodb://${credentialsPrefix}${directHosts}/${rest}${separator}ssl=true&authSource=admin`;
      
      console.log(`Resolved Direct Connection URI: mongodb://${credentialsPrefix}[SHARDS]/${rest}${separator}ssl=true&authSource=admin`);
      resolve(directUri);
    });
  });
}

async function run() {
  try {
    const originalUri = process.env.MONGO_URI;
    console.log(`Original URI: ${originalUri}`);
    
    const resolvedUri = await resolveMongoUri(originalUri);
    await mongoose.connect(resolvedUri);
    console.log("Connected to database successfully!");

    // Get company dem001 or first company in DB
    const Tenant = mongoose.connection.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
    let tenant = await Tenant.findOne({ code: 'dem001' });
    if (!tenant) {
      tenant = await Tenant.findOne();
    }
    if (!tenant) {
      console.error("No tenant/company found in the database. Please initialize a tenant first.");
      process.exit(1);
    }
    const tenantId = tenant._id;
    console.log(`Using Tenant: ${tenant.name || tenant.code} (${tenantId})`);

    // Define EmailTemplate Schema/Model
    const EmailTemplateSchema = require('../models/EmailTemplate');
    const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', EmailTemplateSchema);

    // Remove existing CEO template to avoid duplicates
    await EmailTemplate.deleteMany({ tenantId, name: 'CEO Offer Email Template' });

    // Seed CEO Template
    const ceoTemplate = new EmailTemplate({
      tenantId,
      name: 'CEO Offer Email Template',
      module: 'Recruitment',
      triggerType: 'OFFER_LETTER_ISSUED',
      subject: 'Action Required: CEO Approval Needed for Offer Letter - {{candidateName}}',
      bodyHtml: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #0f172a; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">OFFER LETTER APPROVAL REQUEST - CEO REVIEW</h2>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; color: #1e293b; margin-top: 0; font-weight: 600;">Dear CEO,</p>
            <p style="color: #334155; line-height: 1.6; font-size: 15px;">
              An offer letter for <strong>{{candidateName}}</strong> has been prepared and requires your final review and approval. Below are the key employment and salary details:
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600; width: 45%;">Candidate Name:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{candidateName}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Current Department:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{currentDepartment}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Offered Department:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{department}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Current Designation:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{currentDesignation}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Offered Designation:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{offerDesignation}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Current CTC:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{currentCTC}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Offered CTC:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">{{offerCTC}}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #0f766e;">Percentage Increase:</td>
                  <td style="padding: 8px 0; font-weight: 700; color: #0f766e;">{{percentageIncrease}}</td>
                </tr>
              </table>
            </div>

            <p style="color: #334155; line-height: 1.6; font-size: 15px;">
              Please review the attached offer letter PDF and click the button below to record your decision.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="{{approvalUrl}}" style="background-color: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Review & Approve Offer</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">This is an automated request from the Gitakshmi HRMS portal.</p>
          </div>
        </div>
      `,
      isActive: true
    });

    await ceoTemplate.save();
    console.log("Successfully seeded CEO Offer Email Template!");

  } catch (error) {
    console.error("Error during seeding:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
