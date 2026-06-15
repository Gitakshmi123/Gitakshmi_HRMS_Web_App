const FacebookAdapter = require('./modules/social-media-enterprise/adapters/FacebookAdapter');

const adapter = new FacebookAdapter(process.env.TEST_TOKEN || 'test_token', '975150605690353');

async function run() {
    try {
        console.log("Testing POST /videos fallback...");
        const res = await adapter._publishVideo('https://res.cloudinary.com/dnrsm9jyt/video/upload/v1774011502/hrms_production_uploads/xbicabftvsh3ohfkibqr.mp4', 'test caption', 'post');
        console.log("Success:", res);
    } catch(e) {
        console.error("Error:", e.message);
        if (e.response && e.response.data) {
            console.error(e.response.data);
        }
    }
}
run();
