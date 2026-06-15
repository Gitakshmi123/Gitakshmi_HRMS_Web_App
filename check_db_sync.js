const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const settings = await mongoose.connection.db.collection('attendancesettings').find({}).toArray();
        console.log('Settings:', JSON.stringify(settings, null, 2));
        
        const holidays = await mongoose.connection.db.collection('holidays').find({}).toArray();
        console.log('Holidays Count:', holidays.length);
        // Show sample
        if(holidays.length > 0) console.log('Sample Holiday:', JSON.stringify(holidays[0], null, 2));

        await mongoose.disconnect();
    } catch(e) { console.error(e); }
};
run();
