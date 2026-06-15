
const mongoose = require('mongoose');
require('dotenv').config();

async function seedBgvPages() {
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

    // --- BGV ---
    const bgvMod = await SidebarModule.findOne({ name: /bgv/i });
    if (bgvMod) {
      console.log(`Updating BGV pages for mod: ${bgvMod._id}`);
      await SidebarPage.deleteMany({ moduleId: bgvMod._id });
      const bgvPages = [
        { name: 'Case Master', route: '/hr/bgv', permissionKey: 'bgv.caseMaster', icon: 'bgv', order: 0 },
        { name: 'Email Logs', route: '/hr/bgv/emails', permissionKey: 'bgv.emailLogs', icon: 'email', order: 1 }
      ];
      for (const p of bgvPages) {
        await SidebarPage.create({ ...p, moduleId: bgvMod._id });
        console.log(`✅ Created ${p.name}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedBgvPages();
