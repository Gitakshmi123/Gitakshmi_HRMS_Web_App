const mongoose = require('mongoose');
const { getTenantDB } = require('./server/config/dbManager');
require('dotenv').config({ path: './server/.env' });

async function checkTemplates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Use a dummy tenantId "Himanshu12180" (from user info) or try to find one
        const tenantId = "Himanshu12180";
        const db = getTenantDB(tenantId);

        const LetterTemplate = db.model('LetterTemplate');

        const templates = await LetterTemplate.find({ type: 'joining' });

        console.log("--- JOINING TEMPLATES ---");
        templates.forEach(t => {
            console.log(`ID: ${t._id}`);
            console.log(`Name: ${t.name}`);
            console.log(`Path: ${t.filePath}`);
            console.log(`Exists (Normalized): ${require('fs').existsSync(require('path').resolve(t.filePath))}`);
            console.log("-------------------------");
        });

        mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkTemplates();
