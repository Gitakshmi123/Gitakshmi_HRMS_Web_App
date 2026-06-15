require('dotenv').config();
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { getModels } = require('../utils/tenantUtils');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tenantId = '6a0c43ab3245aa33f5c2a410';
  const tenantDB = await getTenantDB(tenantId);
  const { GeneratedLetter } = getModels(tenantDB);

  const letters = await GeneratedLetter.find({ letterType: 'offer' }).sort({ createdAt: -1 }).limit(3).lean();
  console.log('--- LATEST OFFER LETTERS ---');
  console.log(JSON.stringify(letters, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
