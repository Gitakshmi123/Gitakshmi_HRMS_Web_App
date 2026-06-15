const mongoose = require('mongoose');

const MONGO_URI = "mongodb+srv://ravaldhruv85_db_user:5NxeIbx7yH3mMYiJ@cluster0.rydhhi4.mongodb.net/hrms_e2e_test?retryWrites=true&w=majority&appName=Cluster0";
const tenantId = "6a1eb73c056191af5f4cf27c";

async function run() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully!");

        const CareerSectionSchema = new mongoose.Schema({
            tenantId: String,
            companyId: String,
            sectionId: String,
            sectionType: String,
            sectionOrder: Number,
            content: Object
        }, { collection: 'careersections' });

        const CareerLayoutSchema = new mongoose.Schema({
            tenantId: String,
            companyId: String,
            layoutConfig: {
                theme: Object,
                sectionOrder: [{
                    sectionId: String,
                    sectionType: String,
                    order: Number
                }]
            }
        }, { collection: 'careerlayouts' });

        const PublishedCareerPageSchema = new mongoose.Schema({
            tenantId: String,
            companyId: String,
            sections: Array,
            theme: Object
        }, { collection: 'publishedcareerpages' });

        const CareerSection = mongoose.models.CareerSection || mongoose.model('CareerSection', CareerSectionSchema);
        const CareerLayout = mongoose.models.CareerLayout || mongoose.model('CareerLayout', CareerLayoutSchema);
        const PublishedCareerPage = mongoose.models.PublishedCareerPage || mongoose.model('PublishedCareerPage', PublishedCareerPageSchema);

        const sections = await CareerSection.find({ tenantId }).sort({ sectionOrder: 1 });
        console.log("\n=== DRAFT SECTIONS ===");
        sections.forEach(s => {
            console.log(`- ID: ${s.sectionId}, Type: ${s.sectionType}, Order: ${s.sectionOrder}`);
        });

        const layout = await CareerLayout.findOne({ tenantId });
        console.log("\n=== DRAFT LAYOUT SECTION ORDER ===");
        if (layout && layout.layoutConfig && layout.layoutConfig.sectionOrder) {
            layout.layoutConfig.sectionOrder.forEach(item => {
                console.log(`- ID: ${item.sectionId}, Type: ${item.sectionType}, Order: ${item.order}`);
            });
            console.log("Theme:", layout.layoutConfig.theme);
        } else {
            console.log("No draft layout found.");
        }

        const pub = await PublishedCareerPage.findOne({ tenantId });
        console.log("\n=== PUBLISHED SECTIONS ===");
        if (pub && pub.sections) {
            pub.sections.forEach(s => {
                console.log(`- ID: ${s.id}, Type: ${s.type}, Order: ${s.order}`);
            });
            console.log("Theme:", pub.theme);
        } else {
            console.log("No published page found.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
