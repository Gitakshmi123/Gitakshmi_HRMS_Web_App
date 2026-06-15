const axios = require('axios');
require('dotenv').config();

async function testModels() {
    const key = process.env.GEMINI_API_KEY;
    const endpoints = ['v1', 'v1beta'];
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'gemini-pro'
    ];
    
    for (const v of endpoints) {
        for (const model of models) {
            console.log(`--- Testing: ${v} / ${model} ---`);
            const url = `https://generativelanguage.googleapis.com/${v}/models/${model}:generateContent?key=${key}`;
            try {
                const res = await axios.post(url, {
                    contents: [{ parts: [{ text: "ping" }] }]
                }, { timeout: 5000 });
                console.log(`✅ SUCCESS [${v}/${model}]:`, res.data.candidates?.[0]?.content?.parts?.[0]?.text);
            } catch (err) {
                const status = err.response?.status || 'TIMEOUT';
                const msg = err.response?.data?.error?.message || err.message;
                console.log(`❌ FAILED [${v}/${model}]: ${status} - ${msg.slice(0, 50)}`);
            }
        }
    }
}

testModels();
