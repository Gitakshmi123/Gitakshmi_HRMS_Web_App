const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function diagnose() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

    const email = 'git@gmail.com';
    
    console.log(`\n--- Searching for ${email} in User collection ---`);
    const users = await User.find({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).lean();
    console.log(`Found ${users.length} matching users.`);
    users.forEach(u => {
      console.log(`- ID: ${u._id}, Name: ${u.name || u.firstName}, Role: ${u.role}, Tenant: ${u.tenant}`);
    });

    console.log(`\n--- Searching for ${email} across all Tenant-specific Employee collections ---`);
    const tenants = await Tenant.find({ status: 'active' }).lean();
    for (const t of tenants) {
      try {
        const tenantDb = mongoose.connection.useDb(`tenant_${t._id}`);
        // Wait, the app uses getTenantDB utility, but I'll do it manually here.
        // Actually, let's just use the main connection but with a dynamic model if the DB name is known.
        // Some apps use one DB with tenantId, others use multiple DBs.
        // Based on auth.controller.js, it uses getTenantDB which likely switches DBs.
        
        const EmployeeSchema = new mongoose.Schema({}, { strict: false });
        // Try both standard and tenant-prefixed names
        const Employee = tenantDb.model('Employee', EmployeeSchema);
        const emp = await Employee.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).lean();
        if (emp) {
          console.log(`[Tenant: ${t.code}] Found Employee: ${emp._id}, Name: ${emp.firstName}, Role: ${emp.role}`);
        }
      } catch (e) {
        // ignore
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

diagnose();
