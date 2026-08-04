const mongoose = require('mongoose');
const TenantSchema = new mongoose.Schema({
  companyName: String,
  companyEmail: String,
  adminEmail: String,
  tenantId: String,
  status: String,
}, { collection: 'companies' });
const Tenant = mongoose.model('Tenant', TenantSchema);

async function check() {
  await mongoose.connect('mongodb://localhost:27017/hrms');
  const companies = await Tenant.find({});
  console.log(JSON.stringify(companies, null, 2));
  process.exit();
}
check();
