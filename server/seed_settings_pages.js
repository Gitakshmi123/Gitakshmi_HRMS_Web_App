
const mongoose = require('mongoose');
require('dotenv').config();

async function seedSettingsPages() {
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

    // --- SETTINGS ---
    const settingsMod = await SidebarModule.findOne({ name: /settings/i });
    if (settingsMod) {
      console.log(`Updating Settings pages for mod: ${settingsMod._id}`);
      await SidebarPage.deleteMany({ moduleId: settingsMod._id });
      const settingsPages = [
        { name: 'Global Settings', route: '/hr/settings/company', permissionKey: 'configuration.company', icon: 'settings', order: 0 },
        { name: 'Document Sequences', route: '/hr/settings/sequences', permissionKey: 'configuration.sequences', icon: 'process', order: 1 }
      ];
      for (const p of settingsPages) {
        await SidebarPage.create({ ...p, moduleId: settingsMod._id });
        console.log(`✅ Created ${p.name}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedSettingsPages();
