const mongoose = require('mongoose');
const MONGODB_URI = "mongodb+srv://h12180:Himanshu12@hrms-saas.7n959.mongodb.net/?retryWrites=true&w=majority&appName=HRMS-SaaS";

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        const dbName = 'company_Himanshu12180';
        const tenantDb = mongoose.connection.useDb(dbName);
        
        // Define schemas
        const EmailTemplateSchema = new mongoose.Schema({
            tenantId: { type: mongoose.Schema.Types.ObjectId },
            name: String,
            module: String,
            triggerType: String,
            subject: String,
            bodyHtml: String,
            isActive: Boolean
        }, { collection: 'emailtemplates' });

        const EmailTemplate = tenantDb.model('EmailTemplate', EmailTemplateSchema);
        const templates = await EmailTemplate.find({});
        console.log("Existing Email Templates:");
        console.log(JSON.stringify(templates, null, 2));

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

check();
