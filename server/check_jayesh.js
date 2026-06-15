const mongoose = require('mongoose');
require('dotenv').config();

async function checkJayesh() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tenantId = '698b2b52eaaf4b1b30688ff4';
        const db = mongoose.connection.useDb(`company_${tenantId}`);

        const appId = '698b39c340cd3c3a1639a599'; // Jayesh

        const Applicant = db.model('Applicant', new mongoose.Schema({}, { strict: false }));
        const app = await Applicant.findById(appId);
        console.log('Applicant Jayesh details:', JSON.stringify(app, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkJayesh();
