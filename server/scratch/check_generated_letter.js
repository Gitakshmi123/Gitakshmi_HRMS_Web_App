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
    const tenantId = tenant._id.toString();

    const tenantDB = await getTenantDB(tenantId);
    const { GeneratedLetter } = getModels(tenantDB);
    
    // Find last offer letter generated for jayesh
    const letter = await GeneratedLetter.findOne({ letterType: 'offer' }).sort({ createdAt: -1 });
    if (!letter) {
      console.error("No generated letter found");
      process.exit(1);
    }
    console.log("Last Letter detail:");
    console.log(JSON.stringify({
      id: letter._id,
      letterType: letter.letterType,
      status: letter.status,
      snapshotData: letter.snapshotData
    }, null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
