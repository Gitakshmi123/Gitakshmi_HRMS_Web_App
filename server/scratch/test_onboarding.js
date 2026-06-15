const mongoose = require('mongoose');
require('dotenv').config();
const OnboardingTemplate = require('../models/OnboardingTemplate');

const STANDARD_HR_FORM = {
  name: 'Standard Onboarding Form',
  code: 'STANDARD_HR',
  description: 'Default HR onboarding form including Personal, Bank, Education, and Identity details.',
  isDefault: true,
  status: 'published',
  version: 1,
  sections: []
};

async function testOnboarding() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
        console.log('Connected');

        const tenantId = '69fcd718faa7e986dee243bf';
        
        // Simulate controller logic
        let templates = await OnboardingTemplate.find({ tenant: tenantId, isActive: true }).sort({ version: -1 });
        console.log(`Found ${templates.length} templates`);

        if (templates.length === 0) {
            console.log('Creating default template...');
            const defaultTemplate = await OnboardingTemplate.create({
                ...STANDARD_HR_FORM,
                tenant: tenantId,
                createdBy: '69fcd718faa7e986dee243bf' // dummy id
            });
            console.log('Created:', defaultTemplate.name, defaultTemplate.code);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testOnboarding();
