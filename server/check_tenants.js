const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

(async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String }, { strict: false }));
        const count = await Tenant.countDocuments();
        const all = await Tenant.find({}).lean();
        console.log('COUNT:', count);
        console.log('ALL:', JSON.stringify(all.map(t => ({ id: t._id, code: t.code, name: t.companyName })), null, 2));
        process.exit(0);
    } catch (e) {
        console.log('ERROR:', e.message);
        process.exit(1);
    }
})();
