const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = mongoose.model('Tenant', require('./models/Tenant'));
        const tenant = await Tenant.findOne({ code: 'tes001' });
        if (!tenant) throw new Error('Tenant tes001 not found');

        const { getTenantDB } = require('./config/dbManager');
        const db = getTenantDB(tenant._id.toString());

        const Position = db.model('Position');
        console.log('Fetching positions...');
        const positions = await Position.find({ tenant: tenant._id });
        console.log('Positions found:', positions.length);
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}
run();
