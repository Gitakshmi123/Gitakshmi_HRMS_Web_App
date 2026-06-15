/**
 * BGV Quick Test Script
 * Run: node test_bgv_now.js
 * Tests: Consent, Verify Check, Case Close
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE = 'http://localhost:5003/api';
const JWT_SECRET = 'hrms@123';

// ─── Generate a test HR token ───────────────────────────────
function makeToken(tenantId) {
    return jwt.sign(
        { _id: 'test_user_id', id: 'test_user_id', name: 'Test HR', email: 'hr@test.com', role: 'hr', tenantId },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

// ─── Read from debug.log to find a BGV case ─────────────────
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'hrms' });
    console.log('✅ Connected to DB');

    // Find a tenant
    const tenants = await mongoose.connection.db.collection('tenants').find({}).limit(3).toArray();
    if (!tenants.length) { console.log('❌ No tenants found'); process.exit(1); }

    for (const tenant of tenants) {
        const tenantId = tenant._id.toString();
        const dbName = `tenant_${tenantId}`;
        console.log(`\n🏢 Testing tenant: ${tenant.name || tenantId} (db: ${dbName})`);

        try {
            const tenantConn = await mongoose.createConnection(
                process.env.MONGO_URI.replace('/hrms', `/${dbName}`)
            ).asPromise();

            // Find a BGV case
            const cases = await tenantConn.db.collection('bgv_cases').find({ isClosed: { $ne: true } }).limit(1).toArray();
            if (!cases.length) {
                console.log(`  ⚠️ No open BGV cases in ${dbName}`);
                await tenantConn.close();
                continue;
            }

            const bgvCase = cases[0];
            const caseId = bgvCase._id.toString();
            console.log(`  📋 Found case: ${bgvCase.caseId} (${caseId}), Status: ${bgvCase.overallStatus}`);
            console.log(`     candidateId: ${bgvCase.candidateId}, applicationId: ${bgvCase.applicationId}`);

            // Check consent
            const consents = await tenantConn.db.collection('bgv_consents').find({ caseId: bgvCase._id }).limit(1).toArray();
            console.log(`  📝 Consent exists: ${consents.length > 0 ? 'YES (' + consents[0]?.signatureType + ')' : 'NO'}`);

            // Check checks
            const checks = await tenantConn.db.collection('bgv_checks').find({ caseId: bgvCase._id }).toArray();
            console.log(`  🔍 Checks: ${checks.length} total`);
            checks.forEach(c => console.log(`     - ${c.type}: ${c.status}`));

            const token = makeToken(tenantId);
            const headers = {
                Authorization: `Bearer ${token}`,
                'X-Tenant-ID': tenantId
            };

            // ─── TEST 1: Consent Capture ─────────────────────────
            if (!consents.length) {
                console.log('\n  🧪 TEST 1: Capturing Consent...');
                try {
                    const r = await axios.post(`${BASE}/bgv/case/${caseId}/consent`, {
                        consentGiven: true,
                        signatureType: 'TYPED_NAME',
                        signatureData: 'Test HR Signature',
                        scopeAgreed: checks.map(c => ({ checkType: c.type, agreedAt: new Date() })),
                        location: { city: 'Ahmedabad', country: 'India' }
                    }, { headers });
                    console.log(`  ✅ Consent: ${r.data.message}`);
                } catch (e) {
                    console.log(`  ❌ Consent Error: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
                }
            } else {
                console.log('  ⏭️  Consent already captured, skipping...');
            }

            // ─── TEST 2: Verify a check ──────────────────────────
            const pendingCheck = checks.find(c => !['VERIFIED', 'FAILED'].includes(c.status));
            if (pendingCheck) {
                console.log(`\n  🧪 TEST 2: Verifying check ${pendingCheck.type}...`);
                try {
                    const r = await axios.post(`${BASE}/bgv/check/${pendingCheck._id}/verify`, {
                        status: 'VERIFIED',
                        internalRemarks: 'Test verification',
                        verificationMethod: 'MANUAL'
                    }, { headers });
                    console.log(`  ✅ Check Verify: ${r.data.message}`);
                } catch (e) {
                    console.log(`  ❌ Check Verify Error: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
                }
            } else {
                console.log('  ⏭️  All checks done, skipping verify...');
            }

            // ─── TEST 3: Close Case ──────────────────────────────
            const freshCase = await tenantConn.db.collection('bgv_cases').findOne({ _id: bgvCase._id });
            if (!freshCase.isClosed) {
                console.log(`\n  🧪 TEST 3: Closing BGV Case...`);
                try {
                    const r = await axios.post(`${BASE}/bgv/case/${caseId}/close`, {
                        decision: 'APPROVED',
                        remarks: 'Test closure'
                    }, { headers });
                    console.log(`  ✅ Close: ${r.data.message}`);
                } catch (e) {
                    console.log(`  ❌ Close Error: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
                }
            } else {
                console.log('  ⏭️  Case already closed, skipping...');
            }

            await tenantConn.close();
            break; // Test only first tenant with a case

        } catch (err) {
            console.log(`  ❌ Tenant error: ${err.message}`);
        }
    }

    await mongoose.disconnect();
    console.log('\n✅ Test complete');
    process.exit(0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
