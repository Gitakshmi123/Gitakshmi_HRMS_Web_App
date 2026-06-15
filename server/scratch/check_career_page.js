const mongoose = require('mongoose');
require('dotenv').config();

async function checkCareerPage() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
        const tenantId = '69fcd718faa7e986dee243bf';
        const PublishedCareerPage = mongoose.model('PublishedCareerPage', new mongoose.Schema({}, { strict: false, collection: 'published_career_pages' }));
        
        const page = await PublishedCareerPage.findOne({ tenantId });
        if (page) {
            console.log('Published Career Page found');
            console.log('Slug:', page.seo?.slug);
        } else {
            console.log('No Published Career Page found');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCareerPage();
