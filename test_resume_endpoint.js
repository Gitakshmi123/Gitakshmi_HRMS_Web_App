#!/usr/bin/env node

/**
 * Test script to diagnose resume download issues
 * Run with: node test_resume_endpoint.js
 */

const http = require('http');
const querystring = require('querystring');

const API_URL = 'http://localhost:5003/api';

async function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        console.log(`\n🔍 ${method} ${path}`);

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`✅ Status: ${res.statusCode}`);
                    console.log('📄 Response:', JSON.stringify(parsed, null, 2));
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    console.log(`✅ Status: ${res.statusCode}`);
                    console.log('📄 Response:', data.substring(0, 200));
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test() {
    console.log('🚀 === RESUME DOWNLOAD DIAGNOSIS ===');
    console.log(`API URL: ${API_URL}\n`);

    try {
        // 1. Check if backend is running
        console.log('1️⃣ Testing backend connection...');
        const healthRes = await makeRequest('GET', '/health');
        if (healthRes.status !== 200) {
            console.log('❌ Backend might not be running. Getting different status.');
        }

        // 2. Try to get list of candidates
        console.log('\n2️⃣ Fetching candidates list...');
        const candidatesRes = await makeRequest('GET', '/hr/candidate-status');
        const candidates = candidatesRes.data || [];
        
        if (!Array.isArray(candidates)) {
            console.log('❌ Expected array of candidates');
            return;
        }
        
        console.log(`✅ Found ${candidates.length} candidates`);
        
        if (candidates.length === 0) {
            console.log('⚠️ No candidates found. Try seeding data.');
            return;
        }

        // 3. Get first candidate with resume
        const candidateWithResume = candidates.find(c => c.resume);
        if (!candidateWithResume) {
            console.log('❌ No candidates with resume found');
            console.log('Available candidates:', candidates.map(c => ({
                id: c._id,
                name: c.name,
                resume: c.resume
            })));
            return;
        }

        console.log(`\n3️⃣ Testing candidate with resume: ${candidateWithResume.name}`);
        console.log(`   Resume field: ${candidateWithResume.resume}`);

        // 4. Get full candidate details
        console.log(`\n4️⃣ Fetching full candidate details...`);
        const detailRes = await makeRequest('GET', `/hr/candidate-status/candidates/${candidateWithResume._id}`);
        const candidate = detailRes.data;
        
        if (candidate) {
            console.log(`   Name: ${candidate.name}`);
            console.log(`   Resume: ${candidate.resume}`);
            console.log(`   ResumeURL: ${candidate.resumeUrl}`);
        }

        // 5. Test resume download endpoint
        if (candidate?.resumeUrl) {
            console.log(`\n5️⃣ Testing resume download...`);
            const resumePath = candidate.resumeUrl;
            const downloadRes = await makeRequest('GET', resumePath);
            
            if (downloadRes.status === 404) {
                console.log(`❌ Resume file not found at: ${resumePath}`);
            } else if (downloadRes.status === 200) {
                console.log(`✅ Resume file accessible!`);
                console.log(`   Size: ${downloadRes.data?.length || 'binary'} bytes`);
            }
        } else {
            console.log('❌ No resumeUrl available');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
    
    process.exit(0);
}

test();
