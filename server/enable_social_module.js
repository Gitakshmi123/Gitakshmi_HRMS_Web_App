const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
}

const TenantSchema = new mongoose.Schema({
    companyName: String,
    code: String,
    enabledModules: {
        type: Map,
        of: Boolean,
        default: {}
    }
}, { strict: false });

const Tenant = mongoose.model('Tenant', TenantSchema);

async function enableModule() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const result = await Tenant.updateMany(
            {}, 
            { $set: { 'enabledModules.socialMediaIntegration': true } }
        );

        console.log(`🚀 Successfully updated ${result.modifiedCount} tenants.`);
        console.log('✅ Module "socialMediaIntegration" is now enabled for everyone.');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error enabling module:', err.message);
        process.exit(1);
    }
}

enableModule();
