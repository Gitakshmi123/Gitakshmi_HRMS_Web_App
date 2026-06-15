const mongoose = require('mongoose');

const MONGO_URI = "mongodb+srv://ravaldhruv85_db_user:5NxeIbx7yH3mMYiJ@cluster0.rydhhi4.mongodb.net/hrms_e2e_test?retryWrites=true&w=majority&appName=Cluster0";
const tenantId = "6a1eb73c056191af5f4cf27c";

async function cleanup() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully!");

        // Define schemas
        const CareerSectionSchema = new mongoose.Schema({
            tenantId: String,
            companyId: String,
            sectionId: String,
            sectionType: String,
            sectionOrder: Number,
            content: Object,
            isDraft: Boolean
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
            },
            isDraft: Boolean
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

        // 1. Fetch draft sections
        console.log(`Fetching sections for tenant: ${tenantId}...`);
        const sections = await CareerSection.find({ tenantId }).sort({ sectionOrder: 1 });
        console.log(`Found ${sections.length} sections in draft.`);

        // Find hero sections
        const heroSections = sections.filter(s => s.sectionType === 'hero');
        console.log(`Found ${heroSections.length} Hero sections.`);

        if (heroSections.length > 1) {
            // Keep the first, delete the rest
            const keepHero = heroSections[0];
            const deleteHeroes = heroSections.slice(1);
            
            console.log(`Keeping Hero Section with ID: ${keepHero.sectionId}`);
            for (const dh of deleteHeroes) {
                console.log(`Deleting duplicate Hero Section with ID: ${dh.sectionId}`);
                await CareerSection.deleteOne({ _id: dh._id });
            }

            // 2. Clean up Layout configuration
            const layout = await CareerLayout.findOne({ tenantId });
            if (layout && layout.layoutConfig && layout.layoutConfig.sectionOrder) {
                const deletedIds = deleteHeroes.map(dh => dh.sectionId);
                const originalLength = layout.layoutConfig.sectionOrder.length;
                layout.layoutConfig.sectionOrder = layout.layoutConfig.sectionOrder.filter(
                    item => !deletedIds.includes(item.sectionId)
                );
                // Re-index order
                layout.layoutConfig.sectionOrder.forEach((item, idx) => {
                    item.order = idx;
                });
                layout.markModified('layoutConfig.sectionOrder');
                await layout.save();
                console.log(`Updated layoutConfig.sectionOrder. Removed ${originalLength - layout.layoutConfig.sectionOrder.length} items.`);
            }

            // 3. Clean up Published Career Page
            const pubPage = await PublishedCareerPage.findOne({ tenantId });
            if (pubPage && pubPage.sections) {
                const deletedIds = deleteHeroes.map(dh => dh.sectionId);
                const originalLength = pubPage.sections.length;
                pubPage.sections = pubPage.sections.filter(
                    sec => !deletedIds.includes(sec.id)
                );
                // Re-index order
                pubPage.sections.forEach((sec, idx) => {
                    sec.order = idx;
                });
                pubPage.markModified('sections');
                await pubPage.save();
                console.log(`Updated PublishedCareerPage sections. Removed ${originalLength - pubPage.sections.length} items.`);
            }
            console.log("Cleanup of duplicate Hero sections completed successfully!");
        } else {
            console.log("No duplicate Hero sections found in database.");
        }

    } catch (e) {
        console.error("Cleanup error:", e);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from database.");
    }
}

cleanup();
