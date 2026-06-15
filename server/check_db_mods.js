const mongoose = require('mongoose');
require('dotenv').config();

async function checkModules() {
    try {
        console.log('Connecting...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');
        const Module = mongoose.model('Module', new mongoose.Schema({
            name: String,
            pages: Array
        }));
        
        const mods = await Module.find();
        console.log(`Found ${mods.length} modules.`);
        mods.forEach(m => {
            console.log(`MODULE: ${m.name}`);
            (m.pages || []).forEach(p => {
                console.log(`  PAGE: ${p.name} -> ${p.route}`);
            });
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkModules();
