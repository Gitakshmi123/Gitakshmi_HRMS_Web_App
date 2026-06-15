
const mongoose = require('mongoose');
require('dotenv').config();

async function seedMissingPages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const SidebarModuleSchema = new mongoose.Schema({ name: String });
    const SidebarPageSchema = new mongoose.Schema({
      name: String,
      moduleId: mongoose.Schema.Types.ObjectId,
      route: String,
      permissionKey: String,
      icon: String,
      order: Number,
      isActive: { type: Boolean, default: true }
    }, { collection: 'sidebarpages' });

    const SidebarModule = mongoose.models.SidebarModule || mongoose.model('SidebarModule', SidebarModuleSchema);
    const SidebarPage = mongoose.models.SidebarPage || mongoose.model('SidebarPage', SidebarPageSchema);

    // --- ATTENDANCE ---
    const attendMod = await SidebarModule.findOne({ name: /attendance/i });
    if (attendMod) {
      console.log(`Updating Attendance pages for mod: ${attendMod._id}`);
      await SidebarPage.deleteMany({ moduleId: attendMod._id });
      const attendancePages = [
        { name: 'Attendance Dashboard', route: '/hr/attendance', permissionKey: 'attendance.dashboard', icon: 'attendance', order: 0 },
        { name: 'Attendance Calendar', route: '/hr/attendance-calendar', permissionKey: 'attendance.calendar', icon: 'calendar', order: 1 },
        { name: 'Face Update Requests', route: '/hr/face-update-requests', permissionKey: 'attendance.face', icon: 'attendance', order: 2 }
      ];
      for (const p of attendancePages) {
        await SidebarPage.create({ ...p, moduleId: attendMod._id });
        console.log(`✅ Created ${p.name}`);
      }
    }

    // --- PAYROLL ---
    const payrollMod = await SidebarModule.findOne({ name: /payroll/i });
    if (payrollMod) {
      console.log(`Updating Payroll pages for mod: ${payrollMod._id}`);
      await SidebarPage.deleteMany({ moduleId: payrollMod._id });
      const payrollPages = [
        { name: 'Payroll Stats', route: '/hr/payroll/dashboard', permissionKey: 'payroll.stats', icon: 'payrollDashboard', order: 0 },
        { name: 'Salary Components', route: '/hr/payroll/salary-components', permissionKey: 'payroll.salary', icon: 'salaryComponents', order: 1 },
        { name: 'Compensations', route: '/hr/payroll/compensation', permissionKey: 'payroll.compensation', icon: 'compensation', order: 2 },
        { name: 'Process Payroll', route: '/hr/payroll/process', permissionKey: 'payroll.process', icon: 'process', order: 3 },
        { name: 'Run History', route: '/hr/payroll/run', permissionKey: 'payroll.run', icon: 'runHistory', order: 4 },
        { name: 'Payslips', route: '/hr/payroll/payslips', permissionKey: 'payroll.payslips', icon: 'payslips', order: 5 },
        { name: 'Payslip Templates', route: '/hr/payslip-templates', permissionKey: 'payroll.templates', icon: 'templates', order: 6 }
      ];
      for (const p of payrollPages) {
        await SidebarPage.create({ ...p, moduleId: payrollMod._id });
        console.log(`✅ Created ${p.name}`);
      }
    }

    console.log("Seeding complete.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedMissingPages();
