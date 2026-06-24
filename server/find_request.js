const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectDB = require('./config/db');
const rawToken = "ca36f257c3288c1be5c0818036913de84322103727164949848521368a20748e";
const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

async function run() {
    try {
        console.log("Connecting using connectDB...");
        await connectDB();
        console.log("Connected.");

        // Define schemas
        const TenantSchema = new mongoose.Schema({}, { strict: false });
        const Tenant = mongoose.model('Tenant', TenantSchema, 'tenants');

        const RequestSchema = new mongoose.Schema({
            token: String,
            tenant: mongoose.Schema.Types.ObjectId,
            candidateId: mongoose.Schema.Types.ObjectId,
            applicantId: mongoose.Schema.Types.ObjectId,
            status: String,
            expiresAt: Date
        }, { strict: false });

        console.log("Searching in main database...");
        const CandidateDocumentRequestMain = mongoose.model('CandidateDocumentRequest', RequestSchema, 'candidatedocumentrequests');
        const reqInMain = await CandidateDocumentRequestMain.findOne({
            $or: [
                { token: rawToken },
                { token: hash }
            ]
        });
        if (reqInMain) {
            console.log("Found in main database:", reqInMain);
        } else {
            console.log("Not found in main database.");
        }

        console.log("Fetching all tenants...");
        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants.`);

        for (let t of tenants) {
            const dbName = t.databaseName || `tenant_${t.code || t._id}`;
            console.log(`Checking tenant: ${t.code} (${t._id}) DB: ${dbName}`);
            try {
                // Use mongoose connection to useDb
                const tDb = mongoose.connection.useDb(dbName, { useCache: true });
                const TModel = tDb.model('CandidateDocumentRequest', RequestSchema, 'candidatedocumentrequests');
                const found = await TModel.findOne({
                    $or: [
                        { token: rawToken },
                        { token: hash }
                    ]
                });
                if (found) {
                    console.log(`\n*** FOUND REQUEST IN TENANT: ${t.code} (${t._id}) ***`);
                    console.log(found);
                    console.log(`Token used in DB: ${found.token}`);
                    console.log(`Hashed Token expected: ${hash}`);
                    console.log(`Raw Token: ${rawToken}`);
                    return;
                }
            } catch (err) {
                console.error(`Error checking tenant ${t.code}:`, err.message);
            }
        }
        console.log("Done checking all tenants. Request not found anywhere.");
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
