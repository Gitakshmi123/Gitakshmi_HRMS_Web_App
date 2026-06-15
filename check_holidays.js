const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: './server/.env' });

const checkDocs = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const Holiday = mongoose.model('Holiday', new mongoose.Schema({}, { strict: false }));
        // Check Dec 2025 holidays
        const holidays = await Holiday.find({
            date: { 
                $gte: new Date('2025-12-01'), 
                $lte: new Date('2025-12-31') 
            }
        });

        const output = `
Holidays Dec 2025:
${JSON.stringify(holidays, null, 2)}
        `;
        
        fs.writeFileSync('debug_holidays.txt', output);
        console.log('Written to debug_holidays.txt');

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
        fs.writeFileSync('debug_holidays.txt', 'Error: ' + error.message);
    }
};

checkDocs();
