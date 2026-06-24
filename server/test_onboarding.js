const mongoose = require('mongoose');
const onboardingCtrl = require('./controllers/onboarding.controller');
const getTenantDB = require('./utils/tenantDB');

mongoose.connect('mongodb://127.0.0.1:27017/hrms_saas');
const db = mongoose.connection;
db.once('open', async () => {
  try {
    const Applicant = db.model('Applicant', require('./models/Applicant'));
    const applicant = await Applicant.findOne({ name: 'final' });
    if (!applicant) {
        console.log('Applicant not found'); process.exit(1);
    }
    
    console.log('Applicant found:', applicant.name, 'Tenant:', applicant.tenant);
    
    const tenantId = applicant.tenant.toString();
    const req = { tenantId };
    
    const tenantDB = await getTenantDB(tenantId);
    
    const res = await onboardingCtrl.autoStartOnboardingForApplicant({
        req: { ...req, db: tenantDB, tenantDB },
        applicant,
        actor: { id: null, role: 'system', name: 'System', email: '' },
        source: 'external_profile_approved',
        ensurePortalLink: true,
        notifyCandidate: false
    });
    console.log('Success:', res.instance ? res.instance._id : 'no instance');
    
    if (res.instance) {
      const OnboardingInstance = tenantDB.model('OnboardingInstance', require('./models/OnboardingInstance'));
      await OnboardingInstance.updateOne(
          { _id: res.instance._id },
          { $set: { status: 'verification' } }
      );
      console.log('Fast-forwarded to verification');
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
});
