const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Image Handler Utility
 * Converts Base64 images to files and returns URLs
 * Validates image size to prevent bloat
 * Manages image cleanup for drafts
 */

// Define upload directory
const UPLOAD_BASE_DIR = path.join(__dirname, '../../uploads/career-images');
const MAX_IMAGE_SIZE_MB = 5;

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_BASE_DIR)) {
    fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
    console.log(`✅ Created upload directory: ${UPLOAD_BASE_DIR}`);
}

/**
 * Convert Base64 image to file and return URL
 * @param {string} base64String - Data URL string (e.g., "data:image/jpeg;base64,/9j/...")
 * @param {string} tenantId - Tenant identifier for folder organization
 * @param {string} imageName - Original image name for reference
 * @returns {Promise<{imageUrl: string, imageName: string, imagePath: string}>}
 */
async function saveImageAsUrl(base64String, tenantId, imageName = '') {
    return new Promise((resolve, reject) => {
        try {
            // Validate input
            if (!base64String || typeof base64String !== 'string') {
                return reject(new Error('Invalid base64 string'));
            }

            if (!base64String.startsWith('data:')) {
                return reject(new Error('Not a valid data URL'));
            }

            // Parse data URL
            const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches) {
                return reject(new Error('Invalid data URL format'));
            }

            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Validate image size
            const sizeInMB = buffer.length / (1024 * 1024);
            if (sizeInMB > MAX_IMAGE_SIZE_MB) {
                return reject(new Error(`Image exceeds ${MAX_IMAGE_SIZE_MB}MB limit (${sizeInMB.toFixed(2)}MB)`));
            }

            // Determine file extension
            const ext = getExtensionFromMimeType(mimeType);
            if (!ext) {
                return reject(new Error(`Unsupported image type: ${mimeType}`));
            }

            // Generate unique filename
            const timestamp = Date.now();
            const random = crypto.randomBytes(4).toString('hex');
            const originalName = imageName ? imageName.split('.')[0] : 'image';
            const filename = `${originalName}-${timestamp}-${random}.${ext}`;

            // Create tenant folder
            const tenantDir = path.join(UPLOAD_BASE_DIR, tenantId);
            if (!fs.existsSync(tenantDir)) {
                fs.mkdirSync(tenantDir, { recursive: true });
            }

            // Write file
            const filePath = path.join(tenantDir, filename);
            fs.writeFileSync(filePath, buffer);

            // Return URL (for local storage)
            const imageUrl = `/uploads/career-images/${tenantId}/${filename}`;

            console.log(`✅ Image saved: ${filename} (${sizeInMB.toFixed(2)}MB)`);

            resolve({
                imageUrl,
                imageName: filename,
                imagePath: filePath,
                sizeInMB: sizeInMB.toFixed(2)
            });

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Validate image size without saving
 * @param {string} base64String - Data URL string
 * @returns {Promise<number>} Size in MB
 */
async function validateImageSize(base64String) {
    return new Promise((resolve, reject) => {
        try {
            if (!base64String.startsWith('data:')) {
                return reject(new Error('Not a valid data URL'));
            }

            const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches) {
                return reject(new Error('Invalid data URL format'));
            }

            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const sizeInMB = buffer.length / (1024 * 1024);

            if (sizeInMB > MAX_IMAGE_SIZE_MB) {
                return reject(new Error(`Image exceeds ${MAX_IMAGE_SIZE_MB}MB limit`));
            }

            resolve(sizeInMB);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Delete image file
 * @param {string} imagePath - Full path to image file
 */
async function deleteImage(imagePath) {
    try {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`✅ Deleted image: ${imagePath}`);
        }
    } catch (error) {
        console.error('❌ Error deleting image:', error.message);
    }
}

/**
 * Clean up old draft images (unused)
 * @param {string} tenantId - Tenant identifier
 * @param {Array<string>} activeImageUrls - List of URLs currently in use
 */
async function cleanupUnusedImages(tenantId, activeImageUrls = []) {
    try {
        const tenantDir = path.join(UPLOAD_BASE_DIR, tenantId);
        
        if (!fs.existsSync(tenantDir)) {
            return;
        }

        const files = fs.readdirSync(tenantDir);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(tenantDir, file);
            const fileUrl = `/uploads/career-images/${tenantId}/${file}`;

            // If URL not in active list, delete it
            if (!activeImageUrls.includes(fileUrl)) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`  - Cleaned up: ${file}`);
            }
        }

        if (deletedCount > 0) {
            console.log(`✅ Cleaned up ${deletedCount} unused images for tenant: ${tenantId}`);
        }

    } catch (error) {
        console.error('❌ Error cleaning up images:', error.message);
    }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg'
    };

    return mimeToExt[mimeType] || null;
}

/**
 * Convert entire config object's Base64 images to URLs
 * Recursively processes all nested objects looking for data: URLs
 */
async function convertConfigImagesToUrls(config, tenantId) {
    const converted = { ...config };
    const processedImages = [];

    // Process SEO settings
    if (converted.seoSettings && converted.seoSettings.seo_og_image?.startsWith('data:')) {
        try {
            const result = await saveImageAsUrl(
                converted.seoSettings.seo_og_image,
                tenantId,
                'og-image'
            );
            converted.seoSettings.seo_og_image = result.imageUrl;
            processedImages.push(result.imageUrl);
        } catch (error) {
            console.error('Error processing SEO OG image:', error.message);
        }
    }

    // Process sections
    if (converted.sections && Array.isArray(converted.sections)) {
        for (let i = 0; i < converted.sections.length; i++) {
            const section = converted.sections[i];
            if (section.content && typeof section.content === 'object') {
                // Look for common image fields in section content
                for (const field of ['backgroundImage', 'image', 'headerImage', 'heroImage']) {
                    if (section.content[field]?.startsWith('data:')) {
                        try {
                            const result = await saveImageAsUrl(
                                section.content[field],
                                tenantId,
                                `section-${i}-${field}`
                            );
                            section.content[field] = result.imageUrl;
                            processedImages.push(result.imageUrl);
                        } catch (error) {
                            console.error(`Error processing section ${i} ${field}:`, error.message);
                        }
                    }
                }
            }
        }
    }

    return {
        config: converted,
        processedImages,
        imageCount: processedImages.length
    };
}

module.exports = {
    saveImageAsUrl,
    validateImageSize,
    deleteImage,
    cleanupUnusedImages,
    convertConfigImagesToUrls,
    UPLOAD_BASE_DIR,
    MAX_IMAGE_SIZE_MB
};
