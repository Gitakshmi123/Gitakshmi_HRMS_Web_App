const mongoose = require('mongoose');
const { getTenantDB } = require('./config/dbManager');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Helper to normalize file paths (always absolute)
function normalizeFilePath(filePath) {
    if (!filePath) return null;
    // If already absolute, return as-is (after normalizing separators)
    if (path.isAbsolute(filePath)) {
        return path.normalize(filePath);
    }
    // If relative, resolve from backend/uploads directory
    return path.resolve(__dirname, 'uploads', filePath);
}


async function checkTemplates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Use a dummy tenantId "Himanshu12180" (from user info)
        const tenantId = "Himanshu12180";
        console.log(`Checking templates for tenant: ${tenantId}`);

        const db = getTenantDB(tenantId);

        // Wait a bit for connection
        await new Promise(r => setTimeout(r, 1000));

        const LetterTemplate = db.model('LetterTemplate');

        const templates = await LetterTemplate.find({ type: 'joining' });

        console.log(`Found ${templates.length} joining templates.`);
        console.log("--- JOINING TEMPLATES ---");
        templates.forEach(t => {
            const normalized = normalizeFilePath(t.filePath);
            const exists = fs.existsSync(normalized);

            console.log(`ID: ${t._id}`);
            console.log(`Name: ${t.name}`);
            console.log(`Raw Path: ${t.filePath}`);
            console.log(`Normalized: ${normalized}`);
            console.log(`Exists: ${exists ? 'YES' : 'NO'}`);
            console.log("-------------------------");
        });

        mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkTemplates();
