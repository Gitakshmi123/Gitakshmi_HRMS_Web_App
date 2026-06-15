
const mongoose = require('mongoose');
require('dotenv').config();

async function seedSocialMediaPages() {
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

    // --- SOCIAL MEDIA ---
    const socialMod = await SidebarModule.findOne({ name: /social media/i });
    if (socialMod) {
      console.log(`Updating Social Media pages for mod: ${socialMod._id}`);
      await SidebarPage.deleteMany({ moduleId: socialMod._id });
      const socialPages = [
        { name: 'Dashboard', route: '/hr/settings/social-media', permissionKey: 'socialMedia.dashboard', icon: 'dashboard', order: 0 },
        { name: 'Accounts', route: '/hr/settings/social-media/accounts', permissionKey: 'socialMedia.accounts', icon: 'users', order: 1 },
        { name: 'Create Post', route: '/hr/settings/social-media/create', permissionKey: 'socialMedia.create', icon: 'social', order: 2 },
        { name: 'History', route: '/hr/settings/social-media/history', permissionKey: 'socialMedia.history', icon: 'history', order: 3 }
      ];
      for (const p of socialPages) {
        await SidebarPage.create({ ...p, moduleId: socialMod._id });
        console.log(`✅ Created ${p.name}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedSocialMediaPages();
