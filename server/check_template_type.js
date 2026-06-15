const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const LetterTemplateModel = require('./models/LetterTemplate');
const LetterTemplateSchema = LetterTemplateModel.schema;

async function checkTemplate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Main DB');

        const LetterTemplate = require('./models/LetterTemplate');

        // Find GTPL2 specifically
        const template = await LetterTemplate.findOne({ name: 'GTPL2' });

        if (template) {
            console.log(`\nTemplate: ${template.name} (${template._id})`);
            console.log('Type:', template.templateType);
            console.log('Body Content Preview:');
            console.log(template.bodyContent ? template.bodyContent.substring(0, 500) : 'NO CONTENT');

            // Extract potential placeholders
            const matches = template.bodyContent ? template.bodyContent.match(/{{[^}]+}}/g) : [];
            console.log('Found Placeholders:', matches);
        } else {
            console.log('GTPL2 not found in Main DB');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkTemplate();
