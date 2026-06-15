const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Hardcode URI to avoid dotenv issues for this diagnostic script if possible, 
// or print it to verify.
const MONGODB_URI = "mongodb+srv://h12180:Himanshu12@hrms-saas.7n959.mongodb.net/?retryWrites=true&w=majority&appName=HRMS-SaaS";

// Define Schema locally to avoid requiring extensive unneeded modules
const LetterTemplateSchema = new mongoose.Schema({
    tenantId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['offer', 'joining'], required: true },
    templateType: { type: String, enum: ['BLANK', 'LETTER_PAD', 'WORD'], default: 'BLANK' },
    filePath: { type: String },
    placeholders: [{ type: String }],
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
});

async function check() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected.");

        const dbName = 'company_Himanshu12180';
        const tenantDb = mongoose.connection.useDb(dbName);
        const LetterTemplate = tenantDb.model('LetterTemplate', LetterTemplateSchema);

        const templates = await LetterTemplate.find({ type: 'joining' });
        console.log(`Found ${templates.length} JOINING templates.`);

        templates.forEach(t => {
            console.log(`\nID: ${t._id}`);
            console.log(`Name: ${t.name}`);
            console.log(`Raw Path: ${t.filePath}`);

            if (t.filePath) {
                // Mimic the normalization logic from the controller
                let normalizedPath;
                if (path.isAbsolute(t.filePath)) {
                    normalizedPath = path.normalize(t.filePath);
                } else {
                    // Assuming script is run from root, backend is ./backend
                    normalizedPath = path.resolve(__dirname, 'server', 'uploads', t.filePath);
                }

                // Also check if the path stored is actually relative to 'backend/' or just 'uploads/'
                // The controller does: path.resolve(__dirname, '../uploads', filePath);
                // If filePath is 'templates/foo.docx', and controller is in 'backend/controllers', 
                // it resolves to 'backend/uploads/templates/foo.docx'.

                console.log(`Normalized (Test): ${normalizedPath}`);
                console.log(`Exists on Disk: ${fs.existsSync(normalizedPath) ? 'YES' : 'NO'}`);
            } else {
                console.log("No filePath defined.");
            }
        });

        await mongoose.disconnect();
        console.log("\nDone.");
    } catch (e) {
        console.error(e);
    }
}

check();
