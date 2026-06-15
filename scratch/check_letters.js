const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const checkLetters = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // We need to check all tenant databases or just the main one?
        // Let's check the main 'GeneratedLetter' if it exists, or look for tenants.
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String }));
        const tenants = await Tenant.find({});
        
        for (const tenant of tenants) {
            console.log(`Checking tenant: ${tenant.code} (${tenant._id})`);
            const db = mongoose.connection.useDb(`tenant_${tenant._id}`);
            
            // Define schema locally to avoid registration issues
            const GeneratedLetter = db.model('GeneratedLetter', new mongoose.Schema({
                pdfUrl: String,
                pdfPath: String,
                letterType: String,
                status: String
            }, { strict: false }));

            const letters = await GeneratedLetter.find({}).limit(5);
            console.log(`Found ${letters.length} letters`);
            letters.forEach(l => {
                console.log(`- ID: ${l._id} | Type: ${l.letterType} | Status: ${l.status}`);
                console.log(`  pdfUrl: ${l.pdfUrl}`);
                console.log(`  pdfPath: ${l.pdfPath}`);
            });
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
};

checkLetters();
