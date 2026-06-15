require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function createGitaTenant() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Check if tenant already exists
    const existing = await Tenant.findOne({ code: 'gita001' });
    if (existing) {
      console.log('✓ Tenant gita001 already exists');
      console.log('  Email:', existing.meta?.email || existing.meta?.primaryEmail);
      console.log('  Status:', existing.status);
      
      // Update credentials if needed
      await Tenant.updateOne(
        { code: 'gita001' },
        {
          $set: {
            'meta.email': 'dharmikjethwani777@gmail.com',
            'meta.primaryEmail': 'dharmikjethwani777@gmail.com',
            'meta.adminPassword': 'admin123', // Default password - change after first login
            status: 'active'
          }
        }
      );
      console.log('✓ Updated tenant credentials');
      await mongoose.connection.close();
      return;
    }

    // Create new tenant
    const tenant = await Tenant.create({
      name: 'GITA Company',
      code: 'gita001',
      emailDomain: 'gita.com',
      plan: 'premium',
      status: 'active',
      modules: ['hr', 'payroll', 'ess'],
      meta: {
        email: 'dharmikjethwani777@gmail.com',
        primaryEmail: 'dharmikjethwani777@gmail.com',
        adminPassword: 'your_password_here', // Update with actual password
        ownerName: 'Dharmik Jethwani',
        phone: '+91-0000000000',
        address: 'India',
      },
    });

    console.log('✓ Created tenant: gita001');
    console.log('  Name:', tenant.name);
    console.log('  Email:', tenant.meta.email);
    console.log('  Status:', tenant.status);

    // Initialize tenant database
    try {
      const db = await getTenantDB(tenant._id);
      const EmployeeSchema = require('../models/Employee');
      const DepartmentSchema = require('../models/Department');
      const LeaveRequestSchema = require('../models/LeaveRequest');
      const AttendanceSchema = require('../models/Attendance');
      const ActivitySchema = require('../models/Activity');
      const UserSchema = require('../models/User');

      db.model("Employee", EmployeeSchema);
      db.model("Department", DepartmentSchema);
      db.model("LeaveRequest", LeaveRequestSchema);
      db.model("Attendance", AttendanceSchema);
      db.model("User", UserSchema);
      db.model("Activity", ActivitySchema);

      console.log('✓ Tenant database initialized');
    } catch (dbErr) {
      console.error('⚠ Tenant DB initialization warning:', dbErr.message);
    }

    console.log('\n✓ Tenant created successfully!');
    console.log('\nYou can now login with:');
    console.log('  - Company Code: gita001');
    console.log('  - Email: dharmikjethwani777@gmail.com');
    console.log('  - Password: your_password_here (update this in the script)');

    await mongoose.connection.close();
    console.log('\n✓ Done!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

createGitaTenant();

