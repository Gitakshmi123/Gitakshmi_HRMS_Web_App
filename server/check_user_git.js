const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

(async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const User = mongoose.model('User', new mongoose.Schema({ email: String, tenant: mongoose.Schema.Types.ObjectId }, { strict: false }));
        const u = await User.findOne({ email: /git@gmail\.com/i }).lean();
        console.log('USER:', JSON.stringify(u, null, 2));
        process.exit(0);
    } catch (e) {
        console.log('ERROR:', e.message);
        process.exit(1);
    }
})();
