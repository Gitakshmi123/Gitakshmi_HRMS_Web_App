const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary from environment variables
const configureCloudinary = () => {
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

    if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true
        });
        return true;
    }
    return false;
};

class CloudinaryService {
    /**
     * Uploads a file to Cloudinary
     * @param {string} filePath Local path to the file
     * @param {string} folder Cloudinary folder name
     * @param {boolean} cleanup Whether to delete the local file after upload
     */
    static async uploadFile(filePath, folder = 'hrms_uploads', cleanup = true) {
        try {
            if (!configureCloudinary()) {
                throw new Error('Cloudinary is not configured in .env');
            }

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const result = await cloudinary.uploader.upload(filePath, {
                folder: folder,
                resource_type: 'auto'
            });

            if (cleanup) {
                try {
                    fs.unlinkSync(filePath);
                } catch (e) {
                    console.warn(`[CloudinaryService] Cleanup failed: ${e.message}`);
                }
            }

            return {
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                size: result.bytes
            };
        } catch (error) {
            console.error('[CloudinaryService] Upload error:', error.message);
            throw error;
        }
    }

    /**
     * Check if Cloudinary is configured
     */
    static isConfigured() {
        return configureCloudinary();
    }
}

module.exports = CloudinaryService;
