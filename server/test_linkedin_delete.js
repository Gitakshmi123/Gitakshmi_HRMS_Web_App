const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { decrypt } = require('./modules/social-media-enterprise/utils/tokenEncryption');
require('dotenv').config();

const LinkedInAdapter = require('./modules/social-media-enterprise/adapters/LinkedInAdapter');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
const DB_NAME = 'company_69970ece0441634957df8fb2';
const ACCOUNT_PID = 'urn:li:person:WC9SJjJke1';
const POST_URN = 'urn:li:share:7435333835770462209';

async function testDelete() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.useDb(DB_NAME);

        const account = await db.collection('social_accounts').findOne({ platformAccountId: ACCOUNT_PID });
        if (!account) throw new Error('Account not found');

        const accessToken = decrypt(account.accessToken);
        console.log(`Using access token: ${accessToken.substring(0, 10)}...`);

        const adapter = new LinkedInAdapter(accessToken, ACCOUNT_PID);

        console.log(`\n--- TEST 1: Adapter logic (v2/ugcPosts) ---`);
        console.log(`Attempting deletion of ${POST_URN} using adapter...`);
        try {
            await adapter.deletePost(POST_URN);
            console.log('✅ TEST 1 SUCCESS');
        } catch (err) {
            console.error('❌ TEST 1 FAILED:');
            console.error(err.message);
        }

        console.log(`\n--- TEST 2: Manual v2/shares logic ---`);
        const tag = `[LinkedIn_MANUAL_DELETE] [${POST_URN}]`;
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
        };
        const shareId = POST_URN.split(':').pop();
        const url = `https://api.linkedin.com/v2/shares/${shareId}`;
        console.log(`${tag} Trying DELETE to ${url}...`);
        try {
            await axios.delete(url, { headers });
            console.log(`${tag} ✅ TEST 2 SUCCESS`);
        } catch (err) {
            console.error(`${tag} ❌ TEST 2 FAILED:`);
            console.error(`${err.response?.status} - ${JSON.stringify(err.response?.data || err.message)}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testDelete();
