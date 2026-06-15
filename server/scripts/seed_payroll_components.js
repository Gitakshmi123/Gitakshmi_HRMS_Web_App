const { getTenantDB } = require('../config/dbManager');
const mongoose = require('mongoose');

// Usage: node server/scripts/seed_payroll_components.js <tenantId>
// Example: node server/scripts/seed_payroll_components.js 60f7c2...

async function seed(tenantId) {
  if (!tenantId) {
    console.error('Usage: node seed_payroll_components.js <tenantId>');
    process.exit(1);
  }

  // Ensure mongoose connection is available (uses existing app mongoose connection)
  if (!mongoose.connection || !mongoose.connection.readyState) {
    console.error('No mongoose connection available. Start the backend app or connect mongoose first.');
    process.exit(1);
  }

  const db = getTenantDB(tenantId);
  const seeder = require('../services/payrollComponentSeeder');

  try {
    const results = await seeder.seedDefaultComponents(db, tenantId);
    console.log('Seeding complete:', results);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (require.main === module) {
  const tenantId = process.argv[2];
  seed(tenantId).catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
