const CloudinaryService = require('../modules/social-media-enterprise/services/CloudinaryService');
const fs = require('fs');

/**
 * Diagnostic Controller for Media Uploads
 */
const uploadDiagnosticController = {
    /**
     * Isolated Upload Handler (Exactly as requested)
     * Fields: image
     */
    isolatedUpload: async (req, res) => {
        try {
            // console.log('\n=======================================');
            // console.log('🚀 [HARD-DEBUG] INCOMING UPLOAD REQUEST');
            // console.log('=======================================');
            // console.log('TIMESTAMP:', new Date().toISOString());
            // console.log('METHOD:', req.method);
            // console.log('URL:', req.originalUrl);
            // console.log('HEADERS:', JSON.stringify(req.headers, null, 2));
            // console.log('BODY:', JSON.stringify(req.body, null, 2));
            // console.log('FILE OBJECT:', req.file ? '✅ PRESENT' : '❌ UNDEFINED');

                // console.log('FILE DETAILS:', JSON.stringify({
                //     fieldname: req.file.fieldname,
                //     originalname: req.file.originalname,
                //     mimetype: req.file.mimetype,
                //     path: req.file.path,
                //     size: req.file.size
                // }, null, 2));

            if (!req.file) {
                console.error('❌ [HARD-DEBUG] CRITICAL: MULTER DID NOT CATCH THE FILE');
                console.error('PROBABLE CAUSE: FormData key is NOT "image"');
                return res.status(400).json({
                    success: false,
                    error: "REQ_FILE_UNDEFINED",
                    message: "Backend did not receive your file. You MUST use 'image' as the key in your FormData.",
                    headers_received: req.headers['content-type']
                });
            }

            // console.log(`[Hard-Debug] Calling Cloudinary for: ${req.file.path}`);
            const result = await CloudinaryService.uploadFile(req.file.path, true);

            // console.log('✅ [HARD-DEBUG] UPLOAD SUCCESSFUL!');
            // console.log('URL:', result.url);
            // console.log('=======================================\n');

            res.status(200).json({
                success: true,
                url: result.url,
                publicId: result.publicId
            });
        } catch (error) {
            console.error('\n❌ [HARD-DEBUG] UPLOAD CRASHED:');
            console.error('MESSAGE:', error.message);
            console.error('STACK:', error.stack);
            console.error('FULL ERROR:', JSON.stringify(error, null, 2));
            // console.log('=======================================\n');

            res.status(500).json({
                success: false,
                error: "UPLOAD_CRASH",
                message: error.message,
                details: error
            });
        }
    },

    /**
     * credential verification
     */
    verifyCredentials: async (req, res) => {
        try {
            // console.log('[Debug] 🧪 Running Cloudinary Isolation Test...');
            const result = await CloudinaryService.testConfig();
            res.json({
                success: true,
                message: "Cloudinary Configuration is VALID.",
                secure_url: result.secure_url
            });
            // console.log('✅ [Debug] Isolation Test Successful:', result.secure_url);
        } catch (error) {
            console.error('[Debug] ❌ Isolation Test FAILED:', error.message);
            res.status(500).json({
                success: false,
                message: "Cloudinary Configuration FAILED.",
                error: error.message,
                details: error
            });
        }
    }
};

module.exports = uploadDiagnosticController;
