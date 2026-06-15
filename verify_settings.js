const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const verifySettings = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const AttendanceSettingsSchema = new mongoose.Schema({}, { strict: false });
        const AttendanceSettings = mongoose.model('AttendanceSettings', AttendanceSettingsSchema);

        const settings = await AttendanceSettings.find({});
        console.log('All Settings:', JSON.stringify(settings, null, 2));

        const HolidaySchema = new mongoose.Schema({}, { strict: false });
        const Holiday = mongoose.model('Holiday', HolidaySchema);
        
        // Check for holidays in December 2025
        const start = new Date('2025-12-01');
        const end = new Date('2025-12-31');
        
        const holidays = await Holiday.find({
            date: { $gte: start, $lte: end }
        });
        
        console.log('Holidays in Dec 2025:', JSON.stringify(holidays, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

verifySettings();
