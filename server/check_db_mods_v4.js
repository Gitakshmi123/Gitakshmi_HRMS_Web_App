const mongoose = require('mongoose');
require('dotenv').config();

async function checkModules() {
    try {
        console.log('Connecting...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');
        
        const SidebarModule = mongoose.model('SidebarModule', new mongoose.Schema({
            name: String,
            moduleKey: String
        }), 'sidebarmodules');
        
        const SidebarPage = mongoose.model('SidebarPage', new mongoose.Schema({
            name: String,
            moduleId: mongoose.Schema.Types.ObjectId,
            route: String
        }), 'sidebarpages');
        
        const mods = await SidebarModule.find();
        console.log(`Found ${mods.length} modules.`);
        
        for (const m of mods) {
            console.log(`MODULE: ${m.name} (${m.moduleKey})`);
            const pages = await SidebarPage.find({ moduleId: m._id });
            pages.forEach(p => {
                console.log(`  PAGE: ${p.name} -> ${p.route}`);
            });
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkModules();
