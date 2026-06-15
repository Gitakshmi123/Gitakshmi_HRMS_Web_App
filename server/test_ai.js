const axios = require('axios');
require('dotenv').config();

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    const model = 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    
    console.log('Testing with key:', key.substring(0, 10) + '...');
    
    try {
        const res = await axios.post(url, {
            contents: [{ parts: [{ text: "Hello" }] }]
        });
        console.log('SUCCESS:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('FAILED:', err.response?.data || err.message);
    }
}

testGemini();
