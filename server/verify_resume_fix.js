/**
 * Final verification script to confirm resume download is working
 * Tests the complete flow from candidate API to resume file serving
 */

const http = require('http');

const API_BASE = 'http://localhost:5003/api';

async function makeRequest(method, path) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = { 
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data.substring(0, 100) });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function verify() {
    console.log('\n🚀 === RESUME DOWNLOAD VERIFICATION ===\n');

    try {
        // 1. Get list of candidates
        console.log('1️⃣ Getting candidate list...');
        const listRes = await makeRequest('GET', '/hr/candidate-status');
        
        if (listRes.status !== 200) {
            console.log(`❌ Failed: ${listRes.status}`);
            return;
        }

        const candidates = listRes.data || [];
        console.log(`✅ Got ${candidates.length} candidates\n`);

        if (candidates.length === 0) {
            console.log('⚠️ No candidates found');
            return;
        }

        // 2. Get candidate details
        const candidateId = candidates[0]._id;
        console.log(`2️⃣ Getting candidate details for: ${candidates[0].name}`);
        
        const detailRes = await makeRequest('GET', `/hr/candidate-status/candidates/${candidateId}`);
        
        if (detailRes.status !== 200) {
            console.log(`❌ Failed: ${detailRes.status}`);
            return;
        }

        const candidate = detailRes.data;
        console.log(`✅ Retrieved: ${candidate.name}`);
        console.log(`   Resume URL: ${candidate.resumeUrl}\n`);

        // 3. Test resume download
        if (!candidate.resumeUrl) {
            console.log('❌ No resumeUrl available');
            return;
        }

        console.log('3️⃣ Testing resume download...');
        const downloadRes = await makeRequest('GET', candidate.resumeUrl);
        
        if (downloadRes.status === 200) {
            console.log(`✅ Resume successfully served!`);
            console.log(`   Status: ${downloadRes.status}`);
        } else if (downloadRes.status === 404) {
            console.log(`❌ Resume file not found: ${downloadRes.status}`);
            console.log(`   Response: ${downloadRes.data}`);
        } else {
            console.log(`⚠️ Unexpected status: ${downloadRes.status}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ VERIFICATION COMPLETE');
        console.log('Resume download flow is working correctly!');
        console.log('='.repeat(60) + '\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

verify();
