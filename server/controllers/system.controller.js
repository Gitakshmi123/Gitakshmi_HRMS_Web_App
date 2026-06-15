const mongoose = require('mongoose');
const SidebarModule = mongoose.model('SidebarModule');
const SidebarPage = mongoose.model('SidebarPage');

exports.getModulesFull = async (req, res, next) => {
  try {
    // 1. Fetch modules
    const modules = await SidebarModule.find({ isActive: true }).sort('order').lean();
    
    // 2. Fetch all pages
    const pages = await SidebarPage.find({ isActive: true }).sort('order').lean();
    
    // 3. Attach pages under modules and subpages under parent pages
    const result = modules.map(mod => {
      const modPages = pages.filter(p => String(p.moduleId) === String(mod._id) && !p.parentId);
      const structuredPages = modPages.map(page => {
        const children = pages.filter(p => String(p.parentId) === String(page._id));
        return { ...page, children };
      });
      return { ...mod, pages: structuredPages };
    });
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.seedModules = async (req, res, next) => {
  try {
    const { navGroups } = req.body;
    if (!navGroups || !Array.isArray(navGroups)) {
       return res.status(400).json({ message: "Invalid seed data" });
    }

    // Clear existing
    await SidebarModule.deleteMany({});
    await SidebarPage.deleteMany({});

    for (let i = 0; i < navGroups.length; i++) {
      const g = navGroups[i];
      const mod = await SidebarModule.create({
        name: g.title,
        icon: g.icon || null,
        order: i,
        moduleKey: g.module || null
      });

      for (let j = 0; j < (g.items || []).length; j++) {
        const item = g.items[j];
        const page = await SidebarPage.create({
          name: item.label,
          moduleId: mod._id,
          route: item.to || null,
          permissionKey: item.permissionKey || null,
          icon: item.icon || null,
          isExternal: item.isExternal === true,
          order: j
        });

        if (item.subItems && Array.isArray(item.subItems)) {
          for (let k = 0; k < item.subItems.length; k++) {
            const subItem = item.subItems[k];
            await SidebarPage.create({
              name: subItem.label,
              moduleId: mod._id,
              parentId: page._id,
              route: subItem.to || null,
              permissionKey: subItem.permissionKey || null,
              icon: subItem.icon || null,
              order: k
            });
          }
        }
      }
    }

    res.json({ success: true, message: "Modules seeded successfully" });
  } catch (err) {
    console.error('SEED_ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
