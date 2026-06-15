const axios = require('axios');
require('dotenv').config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    
    try {
        const res = await axios.get(url);
        console.log('MODELS:', JSON.stringify(res.data.models.map(m => m.name), null, 2));
    } catch (err) {
        console.error('FAILED:', err.response?.data || err.message);
    }
}

listModels();
