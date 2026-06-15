const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const getTenantDB = require('../utils/tenantDB');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = await getTenantDB('6a1eb73c056191af5f4cf27c'); // PNR tenant
    if (!db) {
      console.log('Failed to resolve DB connection');
      process.exit(1);
    }
    console.log(`Resolved Database Name: ${db.name}`);

    const LetterTemplate = db.model('LetterTemplate');
    const template = await LetterTemplate.findById('6a202478de98d43d69b8adbd');
    if (!template) {
      console.log('Template not found!');
      process.exit(1);
    }

    console.log('\n--- TEMPLATE DETAIL ---');
    console.log(`ID: ${template._id}`);
    console.log(`Name: ${template.name}`);
    console.log(`Type: ${template.type}`);
    console.log(`templateType: ${template.templateType}`);
    console.log(`filePath: ${template.filePath}`);
    console.log(`placeholders:`, JSON.stringify(template.placeholders));
    console.log(`customFields:`, JSON.stringify(template.customFields));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
