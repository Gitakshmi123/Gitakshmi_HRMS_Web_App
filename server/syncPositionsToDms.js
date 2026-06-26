const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const getTenantDB = require('./utils/tenantDB');

async function syncAllPositions() {
    try {
        console.log('Starting manual position sync to DMS...');
        await mongoose.connect(process.env.MONGO_URI);
        
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({ dmsCompanyId: { $ne: null } }).lean();
        
        if (!tenants || tenants.length === 0) {
            console.log('No tenants found with dmsCompanyId.');
            return;
        }

        const dmsUrl = process.env.DMS_URL;
        const dmsToken = process.env.DMS_SECURE_TOKEN;

        if (!dmsUrl || !dmsToken) {
            console.error('DMS_URL or DMS_SECURE_TOKEN missing in .env');
            return;
        }

        for (const tenant of tenants) {
            console.log(`\nSyncing for tenant: ${tenant.companyName}`);
            // Use tenant._id to properly resolve tenant DB
            const db = await getTenantDB(tenant._id);
            
            if (!db.models.Requirement) {
                db.model('Requirement', require('./models/Requirement'));
            }
            const Requirement = db.model('Requirement');
            const requirements = await Requirement.find({}).lean();
            
            console.log(`Found ${requirements.length} total requirements.`);

            for (const req of requirements) {
                // only sync if Open or Active, or maybe just sync all to be safe?
                const positionId = req.jobOpeningId || String(req._id);
                const positionName = req.jobTitle || 'Unknown Position';

                try {
                    console.log(`Syncing position: ${positionId} - ${positionName}`);
                    await axios.post(
                        `${dmsUrl}/api/v1/hrms/hiring/positions`,
                        {
                            companyId: tenant.dmsCompanyId,
                            positionId: positionId,
                            positionName: positionName
                        },
                        {
                            headers: { 'x-hrms-secure-token': dmsToken }
                        }
                    );
                    console.log(`✅ Synced ${positionId}`);
                } catch (err) {
                    console.error(`❌ Failed to sync ${positionId}:`, err.response?.data?.message || err.message);
                }
            }
        }
        console.log('\nSync completed.');
    } catch (err) {
        console.error('Script error:', err);
    } finally {
        mongoose.disconnect();
    }
}

syncAllPositions();
