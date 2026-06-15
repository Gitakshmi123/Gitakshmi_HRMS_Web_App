const mongoose = require('mongoose');
require('dotenv').config();

const getTenantDB = require('../utils/tenantDB');
const RequirementSchema = require('../models/Requirement');

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: node scripts/tmp_count_requirements.js <tenantIdOrCode>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const db = await getTenantDB(tenantId);
  let Requirement;
  try {
    Requirement = db.model('Requirement');
  } catch {
    Requirement = db.model('Requirement', RequirementSchema);
  }

  const total = await Requirement.countDocuments();
  const statuses = await Requirement.aggregate([
    { $group: { _id: { $ifNull: ['$status', '<<null>>'] }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);

  const vis = await Requirement.aggregate([
    { $group: { _id: { $ifNull: ['$visibility', '<<null>>'] }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);

  console.log(JSON.stringify({ tenantId, total, statuses, visibility: vis }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

