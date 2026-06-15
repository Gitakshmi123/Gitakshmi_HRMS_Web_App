const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hrms';

async function run() {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Check modules
    const modules = await db.collection('sidebarmodules').find({}).toArray();
    console.log("=== MODULES ===");
    modules.forEach(m => console.log(`${m._id} | ${m.name} | ${m.moduleKey}`));
    
    // Check pages
    const pages = await db.collection('sidebarpages').find({}).toArray();
    console.log("\n=== PAGES ===");
    pages.forEach(p => console.log(`${p._id} | ${p.name} | ${p.moduleId} | ${p.permissionKey} | ${p.route}`));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
run();
