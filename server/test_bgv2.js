const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

async function main() {
    await mongoose.connect(process.env.MONGO_URI.replace('/hrms', ''));
    const hrmsDb = mongoose.connection.useDb('hrms');
    const tenants = await hrmsDb.collection('tenants').find({}).toArray();

    for (const t of tenants) {
        const db = mongoose.connection.useDb('company_' + t._id.toString());
        const allCases = await db.collection('bgv_cases').find({}).toArray();
        const cases = allCases.filter(c => !c.isClosed);
        if (cases.length === 0) continue;

        const c = cases[0];
        const checks = await db.collection('bgv_checks').find({ caseId: c._id }).toArray();
        console.log('Open Case:', c.caseId, 'Status:', c.overallStatus, 'consentCaptured:', c.consentCaptured);
        console.log('Checks:', checks.map(ch => ch.type + ':' + ch.status).join(', '));

        const tenantId = t._id.toString();
        const token = jwt.sign(
            { _id: '111111111111111111111111', id: '111111111111111111111111', name: 'Test HR', email: 'hr@test.com', role: 'hr', tenantId },
            'hrms@123', { expiresIn: '1h' }
        );
        const headers = { Authorization: 'Bearer ' + token, 'X-Tenant-ID': tenantId };
        const caseId = c._id.toString();

        // TEST 1: New Consent
        console.log('\n--- Consent Test ---');
        try {
            const r = await axios.post('http://localhost:5003/api/bgv/case/' + caseId + '/consent', {
                consentGiven: true, signatureType: 'TYPED_NAME', signatureData: 'John Doe'
            }, { headers });
            console.log('Consent SUCCESS:', r.data.message);
        } catch (e) {
            console.log('Consent FAIL', e.response?.status + ':');
            console.log('  ', JSON.stringify(e.response?.data));
        }

        // TEST 2: Verify an unverified check
        const unverified = checks.find(ch => !['VERIFIED', 'FAILED', 'CLOSED'].includes(ch.status));
        if (unverified) {
            console.log('\n--- Verify Check', unverified.type, '(' + unverified.status + ') ---');
            try {
                const r = await axios.post('http://localhost:5003/api/bgv/check/' + unverified._id + '/verify', {
                    status: 'VERIFIED', internalRemarks: 'Cleared', verificationMethod: 'MANUAL'
                }, { headers });
                console.log('Verify SUCCESS:', r.data.message);
            } catch (e) {
                console.log('Verify FAIL', e.response?.status + ':');
                console.log('  ', JSON.stringify(e.response?.data));
            }
        } else {
            console.log('\nAll checks already verified/failed.');
        }

        // TEST 3: Close case
        console.log('\n--- Close Case Test ---');
        try {
            const r = await axios.post('http://localhost:5003/api/bgv/case/' + caseId + '/close', {
                decision: 'APPROVED', remarks: 'All verified'
            }, { headers });
            console.log('Close SUCCESS:', r.data.message);
        } catch (e) {
            console.log('Close FAIL', e.response?.status + ':');
            console.log('  ', JSON.stringify(e.response?.data));
        }

        break;
    }
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
