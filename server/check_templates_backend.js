const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Hardcode URI (reusing the one I saw in my head/previous context or from env file usage pattern)
// Ideally I should read .env but let's try to infer or fallback.
// Actually, I'll try to read .env manually to be safe.
const envPath = path.resolve(__dirname, '.env');
let MONGODB_URI = "mongodb+srv://h12180:Himanshu12@hrms-saas.7n959.mongodb.net/?retryWrites=true&w=majority&appName=HRMS-SaaS";

if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    if (envConfig.MONGODB_URI) MONGODB_URI = envConfig.MONGODB_URI;
}

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

        // Tenant ID for current user context
        const dbName = 'company_Himanshu12180';
        const tenantDb = mongoose.connection.useDb(dbName);
        const LetterTemplate = tenantDb.model('LetterTemplate', LetterTemplateSchema);

        const templates = await LetterTemplate.find({ type: 'joining' });
        console.log(`Found ${templates.length} JOINING templates.`);

        console.log("Checking file existence relative to backend/uploads...");

        templates.forEach(t => {
            console.log(`\nID: ${t._id}`);
            console.log(`Name: ${t.name}`);
            console.log(`Raw Path: ${t.filePath}`);

            if (t.filePath) {
                let normalizedPath;
                if (path.isAbsolute(t.filePath)) {
                    normalizedPath = path.normalize(t.filePath);
                } else {
                    // Script is in backend/
                    // Controller logic: path.resolve(__dirname, '../uploads', filePath)  (where __dirname is controllers/)
                    // Equivalent here: path.resolve(__dirname, 'uploads', filePath) (where __dirname is backend/)
                    normalizedPath = path.resolve(__dirname, 'uploads', t.filePath);
                }

                console.log(`Normalized: ${normalizedPath}`);
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
