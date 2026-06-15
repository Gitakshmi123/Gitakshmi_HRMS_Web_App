const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CloudinaryService = require('./CloudinaryService');

/**
 * MediaDownloadService
 * Downloads external images and uploads them to Cloudinary to ensure accessibility for social platforms
 */
class MediaDownloadService {
    static async downloadImage(url) {
        let tempPath = null;
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            // Validate content type
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error('URL does not point to a valid image file');
            }

            // Determine extension
            let ext = 'jpg'; // default
            if (contentType.includes('png')) ext = 'png';
            if (contentType.includes('jpeg')) ext = 'jpg';

            const filename = `dl_${crypto.randomUUID()}.${ext}`;
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            tempPath = path.join(uploadsDir, filename);
            const writer = fs.createWriteStream(tempPath);

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // NOW: Upload to Cloudinary for permanent public HTTPS URL
            const cloudRes = await CloudinaryService.uploadFile(tempPath, true);

            return {
                url: cloudRes.url, // Returns Cloudinary HTTPS URL
                filename: filename
            };
        } catch (error) {
            // Cleanup on catch if file was created before error
            if (tempPath && fs.existsSync(tempPath)) {
                try { fs.unlinkSync(tempPath); } catch (e) { }
            }
            console.error('MediaDownloadService Error:', error.message);
            throw new Error(`Failed to process external image: ${error.message}`);
        }
    }
    static async downloadVideo(url) {
        return this.downloadFile(url, 'video');
    }

    /**
     * Universal downloader for any media type.
     * Returns local filePath (NOT uploaded to Cloudinary, just downloaded locally).
     */
    static async downloadFile(url, typePrefix = 'file') {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        
        // Determine extension
        let ext = 'mp4';
        if (contentType.includes('image/png')) ext = 'png';
        if (contentType.includes('image/jpeg')) ext = 'jpg';
        if (contentType.includes('image/gif')) ext = 'gif';
        if (contentType.includes('video/quicktime')) ext = 'mov';
        if (contentType.includes('video/mp4')) ext = 'mp4';

        const filename = `${typePrefix}_${crypto.randomUUID()}.${ext}`;
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const tempPath = path.join(uploadsDir, filename);
        const writer = fs.createWriteStream(tempPath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        return tempPath;
    }
}

module.exports = MediaDownloadService;
