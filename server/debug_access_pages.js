
const mongoose = require('mongoose');
require('dotenv').config();

async function debugModules() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const SidebarModuleSchema = new mongoose.Schema({}, { strict: false, collection: 'sidebarmodules' });
    const SidebarPageSchema = new mongoose.Schema({}, { strict: false, collection: 'sidebarpages' });

    const SidebarModule = mongoose.models.SidebarModule || mongoose.model('SidebarModule', SidebarModuleSchema);
    const SidebarPage = mongoose.models.SidebarPage || mongoose.model('SidebarPage', SidebarPageSchema);

    const attendMod = await SidebarModule.findOne({ name: /attendance/i });
    const payrollMod = await SidebarModule.findOne({ name: /payroll/i });

    console.log("\n--- ATTENDANCE ---");
    if (attendMod) {
      console.log(`Module: ${attendMod.name} (_id: ${attendMod._id})`);
      const pages = await SidebarPage.find({ moduleId: attendMod._id }).sort('order').lean();
      pages.forEach(p => console.log(`- Page: ${p.name} (pk: ${p.permissionKey}, route: ${p.route})`));
    } else {
      console.log("Attendance module not found.");
    }

    console.log("\n--- PAYROLL ---");
    if (payrollMod) {
      console.log(`Module: ${payrollMod.name} (_id: ${payrollMod._id})`);
      const pages = await SidebarPage.find({ moduleId: payrollMod._id }).sort('order').lean();
      pages.forEach(p => console.log(`- Page: ${p.name} (pk: ${p.permissionKey}, route: ${p.route})`));
    } else {
      console.log("Payroll module not found.");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugModules();
