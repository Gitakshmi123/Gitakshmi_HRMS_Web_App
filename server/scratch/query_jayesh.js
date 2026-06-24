const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const getTenantDB = require('../utils/tenantDB');
const { getModels } = require('../utils/tenantUtils');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);

    const Tenant = mongoose.connection.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
    const tenant = await Tenant.findOne({ code: 'dem001' });
    const tenantId = tenant._id.toString();

    const tenantDB = await getTenantDB(tenantId);
    const { EmailTemplate } = getModels(tenantDB);
    
    // Find all templates
    const templates = await EmailTemplate.find({ isActive: true });
    console.log(`Found ${templates.length} templates:`);
    templates.forEach(t => {
      console.log(`ID: ${t._id}, Name: ${t.name}, Subject: ${t.subject}, Module: ${t.module}, TriggerType: ${t.triggerType}`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
