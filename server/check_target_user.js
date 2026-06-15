
const mongoose = require('mongoose');
require('dotenv').config();

const Tenant = require('./models/Tenant');
const UserSchema = require('./models/User');
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const getTenantDB = require('./utils/tenantDB');

async function checkUser(identifier) {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/hrms_global";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB:", mongoUri.split('@').pop().split('?')[0]);

    const isEmail = identifier.includes('@');
    const finalIdentifier = identifier.trim();

    // 1. PSA Check
    if (finalIdentifier.toLowerCase() === "superadmin@hrms.com") {
      console.log("✅ User is Super Admin (Hardcoded)");
    }

    // 2. Global User search
    if (isEmail) {
      const admin = await User.findOne({ email: finalIdentifier.toLowerCase() }).lean();
      if (admin) {
        const tenant = await Tenant.findById(admin.tenant);
        console.log(`✅ Found in Global User collection:
          - Name: ${admin.name}
          - Email: ${admin.email}
          - Role: ${admin.role}
          - Tenant: ${tenant ? tenant.companyName + ' (' + tenant.code + ')' : admin.tenant}
          - Password Hash: ${admin.password ? admin.password.substring(0, 10) + '...' : 'NONE'}
        `);
      } else {
        console.log(`❌ Not found in Global User collection.`);
      }
    }

    // 3. Employee search across all tenants
    const tenants = await Tenant.find({ status: 'active' });
    console.log(`Checking ${tenants.length} active tenants...`);

    for (const tenant of tenants) {
      try {
        const db = await getTenantDB(tenant._id);
        const Employee = db.model("Employee");
        const query = isEmail 
          ? { email: finalIdentifier.toLowerCase() }
          : { $or: [{ employeeId: finalIdentifier }, { employeeCode: finalIdentifier }] };

        const emp = await Employee.findOne(query).lean();
        if (emp) {
          console.log(`✅ Found in Tenant ${tenant.code} (${tenant.companyName}):
            - Name: ${emp.firstName} ${emp.lastName}
            - Email: ${emp.email}
            - ID: ${emp.employeeId}
            - Role: ${emp.role}
            - Password Hash: ${emp.password ? emp.password.substring(0, 10) + '...' : 'NONE'}
          `);
        }
      } catch (err) {
        // console.log(`Error checking tenant ${tenant.code}: ${err.message}`);
      }
    }

    console.log("Check complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

const target = "Hello@gmain.com";
checkUser(target);
