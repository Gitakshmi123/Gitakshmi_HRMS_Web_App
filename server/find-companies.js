const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        const envPath = path.join(__dirname, '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const uris = [];
        envContent.split('\n').forEach((line, i) => {
            const m = line.match(/(mongodb\+srv:\/\/[^\s]+)/);
            if (m) uris.push({ uri: m[1], line: i + 1 });
        });

        console.log(`Checking ${uris.length} URIs...`);

        for (const item of uris) {
            console.log(`\n[Line ${item.line}] URI: ${item.uri.substring(0, 50)}...`);
            try {
                const conn = await mongoose.createConnection(item.uri, {
                    serverSelectionTimeoutMS: 5000,
                    connectTimeoutMS: 5000
                }).asPromise();

                const Tenant = conn.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
                const tenants = await Tenant.find({}, 'name').lean();
                console.log(`✅ FOUND ${tenants.length} COMPANIES: ${tenants.map(t => t.name).join(', ')}`);
                await conn.close();
            } catch (e) {
                console.log(`❌ ERROR: ${e.message}`);
            }
        }
    } catch (globalErr) {
        console.error('GLOBAL ERROR:', globalErr);
    }
    process.exit(0);
}

run();
