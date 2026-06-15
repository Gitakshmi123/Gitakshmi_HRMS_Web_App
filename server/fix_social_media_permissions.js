/**
 * fix_social_media_permissions.js
 * ──────────────────────────────────────────────────────────────────
 * Fixes the Social Media module permissionKey values in the SidebarPage
 * collection. The old seeded data used 'socialMedia.management' for ALL
 * 4 Social Media pages. This script updates them to the correct granular keys:
 *   - Dashboard   → socialMedia.dashboard
 *   - Accounts    → socialMedia.accounts
 *   - Create Post → socialMedia.create
 *   - History     → socialMedia.history
 *
 * Run once: node fix_social_media_permissions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// ── Load env ──────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env — please set MONGODB_URI');
  process.exit(1);
}

// ── Minimal schemas ───────────────────────────────────────────────
const SidebarModuleSchema = new mongoose.Schema({
  name: String, icon: String, order: Number, moduleKey: String, isActive: { type: Boolean, default: true }
});
const SidebarPageSchema = new mongoose.Schema({
  name: String, moduleId: mongoose.Schema.Types.ObjectId, parentId: mongoose.Schema.Types.ObjectId,
  route: String, permissionKey: String, icon: String, isExternal: Boolean, order: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const SidebarModule = mongoose.model('SidebarModule', SidebarModuleSchema);
const SidebarPage   = mongoose.model('SidebarPage', SidebarPageSchema);

// ── Social Media page name → correct permissionKey mapping ────────
const PAGE_KEY_MAP = {
  'Dashboard':   'socialMedia.dashboard',
  'Accounts':    'socialMedia.accounts',
  'Create Post': 'socialMedia.create',
  'History':     'socialMedia.history',
};

async function fix() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');

    // Find the Social Media module
    const socialMod = await SidebarModule.findOne({ name: 'Social Media' }).lean();
    if (!socialMod) {
      console.error('❌ Social Media module not found in SidebarModule collection');
      process.exit(0);
    }
    console.log(`✅ Found Social Media module: ${socialMod._id}`);

    // Fetch all its pages
    const pages = await SidebarPage.find({ moduleId: socialMod._id }).lean();
    console.log(`📄 Pages found: ${pages.length}`);
    pages.forEach(p => console.log(`  - ${p.name} → current permissionKey: "${p.permissionKey}"`));

    let updated = 0;
    for (const page of pages) {
      const correctKey = PAGE_KEY_MAP[page.name];
      if (!correctKey) {
        console.log(`⚠️  Unknown page name "${page.name}" — skipping`);
        continue;
      }
      if (page.permissionKey === correctKey) {
        console.log(`  ✓ "${page.name}" already correct (${correctKey})`);
        continue;
      }
      await SidebarPage.updateOne({ _id: page._id }, { $set: { permissionKey: correctKey } });
      console.log(`  ✏️  Updated "${page.name}": "${page.permissionKey}" → "${correctKey}"`);
      updated++;
    }

    console.log(`\n✅ Done — ${updated} page(s) updated.`);

    // Also fix any existing User permissions that use the old 'socialMedia.management' key
    // by replacing it with all 4 granular keys (view/create/edit/delete from the old entry)
    const User = mongoose.model('User', new mongoose.Schema({
      permissions: [{ module: String, actions: mongoose.Schema.Types.Mixed }],
      permVersion: Number
    }));

    const usersWithOldKey = await User.find({ 'permissions.module': 'socialMedia.management' }).lean();
    console.log(`\n👥 Users with old 'socialMedia.management' key: ${usersWithOldKey.length}`);

    for (const u of usersWithOldKey) {
      const oldPerm = u.permissions.find(p => p.module === 'socialMedia.management');
      const oldActions = oldPerm?.actions || { view: false, create: false, edit: false, delete: false };

      // Remove old key, add 4 granular keys with same actions
      const newPerms = u.permissions.filter(p => p.module !== 'socialMedia.management');
      for (const newKey of ['socialMedia.dashboard', 'socialMedia.accounts', 'socialMedia.create', 'socialMedia.history']) {
        // Only add if not already present
        if (!newPerms.find(p => p.module === newKey)) {
          newPerms.push({ module: newKey, actions: { ...oldActions } });
        }
      }

      await User.updateOne({ _id: u._id }, {
        $set: { permissions: newPerms, permVersion: (u.permVersion || 0) + 1 }
      });
      console.log(`  ✏️  Migrated User ${u._id}: socialMedia.management → 4 granular keys`);
    }

    console.log('\n🎉 All fixes applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fix();
