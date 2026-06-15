require('dotenv').config();
const mongoose = require('mongoose');

// Register Tenant to be safe in case of refs
try { require('./models/Tenant'); } catch (e) { console.log('Tenant model load skip', e.message); }

const CompanyIdConfig = require('./models/CompanyIdConfig');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function fix() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to Mongo.");

        // Find configurations that look stuck (start 10, curr 1000)
        const configs = await CompanyIdConfig.find({});

        for (const c of configs) {
            console.log(`Checking ${c.entityType}: Start=${c.startFrom}, Curr=${c.currentSeq}`);

            // Fix condition: Current is Default (1000) BUT Start is Lower (<1000)
            // This implies the user tried to lower it, but the defensive code blocked it.
            if (c.entityType === 'EMPLOYEE' && c.currentSeq === 1000 && c.startFrom < 1000) {
                console.log(`Fixing stuck sequence for ${c._id}... setting to ${c.startFrom}`);
                c.currentSeq = c.startFrom;
                await c.save();
                console.log("Fixed.");
            }
        }

        console.log("Done.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fix();
