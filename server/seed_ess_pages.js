
const mongoose = require('mongoose');
require('dotenv').config();

async function seedPages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const SidebarPageSchema = new mongoose.Schema({
      name: String,
      moduleId: mongoose.Schema.Types.ObjectId,
      route: String,
      permissionKey: String,
      icon: String,
      order: Number,
      isActive: { type: Boolean, default: true }
    }, { collection: 'sidebarpages' });

    const SidebarModuleSchema = new mongoose.Schema({
        name: String
    }, { collection: 'sidebarmodules' });

    const SidebarPage = mongoose.models.SidebarPage || mongoose.model('SidebarPage', SidebarPageSchema);
    const SidebarModule = mongoose.models.SidebarModule || mongoose.model('SidebarModule', SidebarModuleSchema);

    // 1. Find the "emp service" module
    const essMod = await SidebarModule.findOne({ name: /emp service/i });
    if (!essMod) {
      console.error("❌ 'emp service' module NOT found in database.");
      process.exit(1);
    }
    console.log(`Found module: ${essMod.name} (_id: ${essMod._id})`);

    // 2. Clear existing pages for this module
    const deleteRes = await SidebarPage.deleteMany({ moduleId: essMod._id });
    console.log(`Cleared ${deleteRes.deletedCount} existing pages for this module.`);

    // 3. Definition of 7 ESS pages
    const pages = [
      { name: 'Dashboard', route: '/employee/dashboard', permissionKey: 'employee.dashboard', icon: 'dashboard', order: 0 },
      { name: 'Attendance', route: '/employee/attendance', permissionKey: 'employee.attendance', icon: 'attendance', order: 1 },
      { name: 'Payslip', route: '/employee/payslips', permissionKey: 'employee.payslips', icon: 'payslips', order: 2 },
      { name: 'Onboarding', route: '/employee/onboarding', permissionKey: 'onboarding.employeePortal', icon: 'onboarding', order: 3 },
      { name: 'Internal Jobs', route: '/employee/internal-jobs', permissionKey: 'employee.jobs', icon: 'requirements', order: 4 },
      { name: 'Support Center', route: '/employee/support-center', permissionKey: 'employee.tickets', icon: 'support', order: 5 },
      { name: 'Resignation', route: '/employee/resignation', permissionKey: 'employee.exit', icon: 'exit', order: 6 },
    ];

    // 4. Create pages
    for (const p of pages) {
      await SidebarPage.create({
        ...p,
        moduleId: essMod._id
      });
      console.log(`✅ Created page: ${p.name}`);
    }

    console.log("Seeding complete. Please refresh the Access page.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedPages();
