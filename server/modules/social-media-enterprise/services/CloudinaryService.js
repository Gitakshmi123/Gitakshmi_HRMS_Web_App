const cloudinary = require('cloudinary').v2;
const fs = require('fs');

/**
 * CloudinaryService
 * Standardized configuration and upload handling
 */

// Load and Cleanup ENV (Prevents hidden spaces from copy-paste)
const CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const API_KEY = (process.env.CLOUDINARY_API_KEY || '').trim();
const API_SECRET = (process.env.CLOUDINARY_API_SECRET || '').trim();

// 1. Configure Cloudinary
cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET
});

// 2. Immediate Startup Check (Hard Diagnostics)
/*
console.log('--- [CLOUDINARY-CORE-LOG] CONFIGURATION ---');
console.log('CLOUD_NAME:', CLOUD_NAME || '❌ UNDEFINED');
console.log('API_KEY:', API_KEY ? `✅ LOADED (***${API_KEY.slice(-4)})` : '❌ UNDEFINED');
console.log('API_SECRET:', API_SECRET ? '✅ LOADED (******)' : '❌ UNDEFINED');
console.log('-------------------------------------------');
*/

class CloudinaryService {
    /**
     * Uploads a local file to Cloudinary
     * Returns public URL and cleans up local temporary file
     */
    static async uploadFile(filePath, cleanup = true) {
        try {
            // console.log(`[CloudinaryService] 🚀 Starting Upload for: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                console.error(`[CloudinaryService] ❌ File M.I.A: ${filePath}`);
                throw new Error(`Physical file missing at path: ${filePath}`);
            }

            const result = await cloudinary.uploader.upload(filePath, {
                folder: 'hrms_production_uploads',
                resource_type: 'auto'
            });

            // console.log(`[CloudinaryService] ✅ SUCCESS: ${result.secure_url}`);

            if (cleanup) {
                try {
                    fs.unlinkSync(filePath);
                    // console.log(`[CloudinaryService] 🧹 Local temp file cleaned up`);
                } catch (e) {
                    console.warn(`[CloudinaryService] ⚠️ Cleanup failed: ${e.message}`);
                }
            }

            return {
                url: result.secure_url,
                publicId: result.public_id
            };
        } catch (error) {
            console.error('[CloudinaryService] ❌ DETAILED UPLOAD ERROR:');
            console.error('Message:', error.message);
            console.error('Code:', error.http_code);
            console.error('Provider Response:', JSON.stringify(error, null, 2));
            throw error;
        }
    }

    /**
     * credential verification
     */
    static async testConfig() {
        console.log('[CloudinaryService] 🧪 Isolation Test - Uploading Dummy Buffer...');
        const result = await cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
            folder: 'test_isolation'
        });
        return result;
    }
}

module.exports = CloudinaryService;
