
const mongoose = require('mongoose');
require('dotenv').config();

async function checkModules() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Define models if not already defined (or just use schema if we don't have model)
    // Actually, in the server app they are already registered.
    // But here we need to register them for this script.
    
    const SidebarModuleSchema = new mongoose.Schema({}, { strict: false });
    const SidebarPageSchema = new mongoose.Schema({}, { strict: false });
    
    const SidebarModule = mongoose.models.SidebarModule || mongoose.model('SidebarModule', SidebarModuleSchema);
    const SidebarPage = mongoose.models.SidebarPage || mongoose.model('SidebarPage', SidebarPageSchema);

    const modules = await SidebarModule.find({}).lean();
    console.log(`Modules found: ${modules.length}`);
    
    for (const mod of modules) {
       const pagesCount = await SidebarPage.countDocuments({ moduleId: mod._id });
       console.log(`- Module: ${mod.name} (pages: ${pagesCount})`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkModules();
