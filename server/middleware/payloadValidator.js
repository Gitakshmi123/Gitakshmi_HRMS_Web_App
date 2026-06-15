/**
 * Middleware to validate incoming payload size
 * Prevents MongoDB 16MB BSON document limit errors
 * Automatically strips large objects (previews, screenshots, base64 images)
 * 
 * Usage: router.post('/endpoint', payloadValidator(10), controller.handler);
 * maxSizeMB parameter: Maximum allowed payload size in MB
 */

const payloadValidator = (maxSizeMB = 10) => {
    return (req, res, next) => {
        try {
            const payloadStr = JSON.stringify(req.body);
            const payloadSizeMB = Buffer.byteLength(payloadStr) / (1024 * 1024);

            console.log(`📊 Payload size: ${payloadSizeMB.toFixed(2)}MB (limit: ${maxSizeMB}MB)`);

            // If within limit, proceed
            if (payloadSizeMB <= maxSizeMB) {
                return next();
            }

            // If too large, attempt to strip large objects and retry
            console.warn(`⚠️ Payload exceeds ${maxSizeMB}MB, stripping large objects...`);
            
            req.body = stripLargeObjects(req.body);

            const strippedStr = JSON.stringify(req.body);
            const strippedSizeMB = Buffer.byteLength(strippedStr) / (1024 * 1024);

            console.log(`📊 Stripped payload size: ${strippedSizeMB.toFixed(2)}MB`);

            if (strippedSizeMB > maxSizeMB) {
                return res.status(413).json({
                    error: `Payload too large. After removing previews/images: ${strippedSizeMB.toFixed(2)}MB (limit: ${maxSizeMB}MB)`,
                    suggestion: 'Remove large image uploads and try again',
                    payloadSizeMB: strippedSizeMB.toFixed(2)
                });
            }

            // Proceed with stripped payload
            console.log('✅ Payload cleaned and within limits');
            next();

        } catch (error) {
            console.error('❌ [payloadValidator] Error:', error.message);
            res.status(400).json({ error: 'Invalid request payload' });
        }
    };
};

/**
 * Strip large objects from request that aren't needed in database
 * - Removes preview screenshots and full HTML snapshots
 * - Removes base64 encoded images
 * - Removes large editor data
 */
function stripLargeObjects(obj) {
    const stripped = JSON.parse(JSON.stringify(obj)); // Deep copy

    // Remove UI previews and screenshots
    delete stripped.preview;
    delete stripped.fullScreenshot;
    delete stripped.preview_screenshot;
    delete stripped.entireHTMLSnapshot;
    delete stripped.previewHTML;
    delete stripped.screenshotData;

    // Remove large editor/builder data
    delete stripped.editorState;
    delete stripped.previousState;
    delete stripped.backupData;

    // Clean base64 images from top level
    Object.keys(stripped).forEach(key => {
        if (typeof stripped[key] === 'string' && stripped[key].startsWith('data:')) {
            console.log(`  - Removing base64 from field: ${key}`);
            delete stripped[key];
        }
    });

    // Clean base64 images from nested objects
    if (stripped.seoSettings && typeof stripped.seoSettings === 'object') {
        Object.keys(stripped.seoSettings).forEach(key => {
            if (typeof stripped.seoSettings[key] === 'string' && stripped.seoSettings[key].startsWith('data:')) {
                console.log(`  - Removing base64 from seoSettings.${key}`);
                stripped.seoSettings[key] = ''; // Keep field, empty value
            }
        });
    }

    // Clean base64 from sections
    if (stripped.sections && Array.isArray(stripped.sections)) {
        stripped.sections = stripped.sections.map((section, idx) => {
            const clean = { ...section };
            
            // Remove content preview
            if (clean.contentPreview) {
                delete clean.contentPreview;
            }

            // Clean base64 from section content
            if (clean.content && typeof clean.content === 'object') {
                Object.keys(clean.content).forEach(contentKey => {
                    const value = clean.content[contentKey];
                    
                    // Remove base64 strings
                    if (typeof value === 'string' && value.startsWith('data:')) {
                        console.log(`  - Removing base64 from sections[${idx}].content.${contentKey}`);
                        delete clean.content[contentKey];
                    }
                    
                    // Remove large arrays of objects (like gallery images)
                    if (Array.isArray(value) && value.length > 50) {
                        console.log(`  - Removing large array from sections[${idx}].content.${contentKey}`);
                        delete clean.content[contentKey];
                    }
                });
            }

            return clean;
        });
    }

    // Clean from theme
    if (stripped.theme && typeof stripped.theme === 'object') {
        Object.keys(stripped.theme).forEach(key => {
            if (typeof stripped.theme[key] === 'string' && stripped.theme[key].startsWith('data:')) {
                delete stripped.theme[key];
            }
        });
    }

    return stripped;
}

module.exports = payloadValidator;
