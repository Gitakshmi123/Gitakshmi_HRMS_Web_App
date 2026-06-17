const mongoose = require('mongoose');
const dbManager = require('../config/dbManager');

async function main() {
    try {
        const uri = "mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0";
        await mongoose.connect(uri);
        const db = dbManager.getTenantDB("69d626068560596a949a0010", "company_pnr");
        
        const templates = await db.model('LetterTemplate').find({}).lean();
        console.log("Available templates:");
        templates.forEach(t => {
            console.log(`- ID: ${t._id}, Name: ${t.name}, Type: ${t.type}, TemplateType: ${t.templateType}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
