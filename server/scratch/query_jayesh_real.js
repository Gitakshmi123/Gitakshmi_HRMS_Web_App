const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const getTenantDB = require('../utils/tenantDB');
const { getModels } = require('../utils/tenantUtils');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const Tenant = mongoose.connection.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
    const tenant = await Tenant.findOne({ code: 'dem001' });
    if (!tenant) {
      console.error("Tenant dem001 not found");
      process.exit(1);
    }
    const tenantId = tenant._id.toString();

    const tenantDB = await getTenantDB(tenantId);
    const { Applicant } = getModels(tenantDB);
    
    // Find Jayesh
    const applicant = await Applicant.findOne({ name: /jayesh/i });
    if (!applicant) {
      console.error("Applicant Jayesh not found");
      process.exit(1);
    }
    console.log("Applicant detail:");
    console.log(applicant);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
