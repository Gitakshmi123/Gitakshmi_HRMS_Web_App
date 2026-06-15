const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * 🔍 BGV OCR Engine
 * Handles text extraction from images and PDFs for background verification
 */
class BGVOCREngine {

    /**
     * Process a document and extract text
     * @param {String} filePath - Full path to the document file
     * @param {String} mimeType - File mime type
     * @returns {Promise<Object>} - Extracted text and confidence
     */
    static async extractText(filePath, mimeType) {
        console.log(`[OCR_ENGINE] Processing: ${filePath} (${mimeType})`);

        try {
            if (mimeType === 'application/pdf') {
                return await this.processPdf(filePath);
            } else if (mimeType.startsWith('image/')) {
                return await this.processImage(filePath);
            } else {
                throw new Error(`Unsupported file type for OCR: ${mimeType}`);
            }
        } catch (error) {
            console.error('[OCR_ENGINE] Error details:', error);
            throw error;
        }
    }

    /**
     * Extract text from PDF
     */
    static async processPdf(filePath) {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);

        // If text is too short, it might be a scanned PDF (image inside PDF)
        // In a real production system, we'd use ghostscript or similar to convert PDF pages to images
        // For this implementation, we'll return what we found

        return {
            text: data.text,
            confidence: 90, // pdf-parse doesn't give confidence, assuming high for native PDFs
            pages: data.numpages,
            method: 'PDF_PARSE'
        };
    }

    /**
     * Extract text from Image using Tesseract.js
     */
    static async processImage(filePath) {
        // PRE-PROCESSING: Convert to grayscale and increase contrast for better OCR
        const processedImagePath = `${filePath}_processed.png`;
        await sharp(filePath)
            .grayscale()
            .normalize()
            .toFile(processedImagePath);

        try {
            const worker = await Tesseract.createWorker('eng');
            const ret = await worker.recognize(processedImagePath);
            await worker.terminate();

            // Clean up processed image
            if (fs.existsSync(processedImagePath)) {
                fs.unlinkSync(processedImagePath);
            }

            return {
                text: ret.data.text,
                confidence: Math.round(ret.data.confidence),
                method: 'TESSERACT'
            };
        } catch (err) {
            if (fs.existsSync(processedImagePath)) {
                fs.unlinkSync(processedImagePath);
            }
            throw err;
        }
    }

    /**
     * Simple parser to find common patterns in OCR text
     */
    static findPatterns(text) {
        const patterns = {
            aadhaar: /\d{4}\s\d{4}\s\d{4}/,
            pan: /[A-Z]{5}[0-9]{4}[A-Z]{1}/,
            dob: /(\d{2}[\/-]\d{2}[\/-]\d{4})|(\d{2}\s\w{3}\s\d{4})/,
            email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        };

        const results = {};
        for (const [key, regex] of Object.entries(patterns)) {
            const match = text.match(regex);
            if (match) results[key] = match[0];
        }

        return results;
    }
}

module.exports = BGVOCREngine;
