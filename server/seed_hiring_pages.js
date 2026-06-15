
const mongoose = require('mongoose');
require('dotenv').config();

async function seedHiringPages() {
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

    // --- HIRING ---
    const hiringMod = await SidebarModule.findOne({ name: /hiring/i });
    if (hiringMod) {
      console.log(`Updating Hiring pages for mod: ${hiringMod._id}`);
      await SidebarPage.deleteMany({ moduleId: hiringMod._id });
      const hiringPages = [
        { name: 'Job List', route: '/hr/requirements', permissionKey: 'hiring.jobList', icon: 'requirements', order: 0 },
        { name: 'Create Req', route: '/hr/create-requirement', permissionKey: 'hiring.createReq', icon: 'requirements', order: 1 },
        { name: 'External', route: '/hr/applicants', permissionKey: 'hiring.external', icon: 'applicants', order: 2 },
        { name: 'Internal', route: '/hr/internal-applicants', permissionKey: 'hiring.internal', icon: 'applicants', order: 3 },
        { name: 'Tracker', route: '/hr/candidate-status', permissionKey: 'hiring.tracker', icon: 'tracker', order: 4 },
        { name: 'Templates', route: '/hr/offer-templates', permissionKey: 'hiring.templates', icon: 'templates', order: 5 }
      ];
      for (const p of hiringPages) {
        await SidebarPage.create({ ...p, moduleId: hiringMod._id });
        console.log(`✅ Created ${p.name}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedHiringPages();
