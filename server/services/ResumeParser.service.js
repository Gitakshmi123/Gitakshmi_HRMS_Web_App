const fs = require('fs');
const path = require('path');
let pdfParse = require('pdf-parse');
// Handle ESM/CJS interop or weird bundling
if (typeof pdfParse !== 'function') {
    if (pdfParse.default) pdfParse = pdfParse.default;
    else if (pdfParse.PDFParse) pdfParse = pdfParse.PDFParse;
}
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');



class ResumeParserService {

    /**
     * Main Entry Point
     * @param {string} filePath 
     * @param {string} mimeType 
     */
    async parseResume(filePath, mimeType) {
        console.log(`[ResumeParser] Parsing ${filePath} (${mimeType})`);

        let text = "";

        try {
            if (mimeType === 'application/pdf') {
                text = await this.parsePDF(filePath);
            } else if (
                mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                mimeType === 'application/msword'
            ) {
                text = await this.parseDOCX(filePath);
            } else if (mimeType.startsWith('image/')) {
                text = await this.parseImage(filePath);
            } else {
                throw new Error('Unsupported file format. Please upload PDF, DOCX, or Image.');
            }

            // Cleanup text
            text = text.replace(/\s+/g, ' ').trim();

            if (text.length < 10) {
                throw new Error('Extracted text is too short (<10 chars). Please upload a text-based PDF or Word document. Scanned PDFs are not supported without OCR.');
            }

            return text;
        } catch (error) {
            console.error('[ResumeParser] Error:', error.message);
            throw error;
        }
    }

    async parsePDF(filePath) {
        const dataBuffer = fs.readFileSync(filePath);
        try {
            const data = await pdfParse(dataBuffer);

            // Check if text is sufficient, else it might be scanned
            if (!data.text || data.text.length < 100) {
                console.warn('[ResumeParser] PDF text is empty or too short. Possible scanned PDF.');
                // Optional: Implement OCR for PDF here if tools allowed
                // For now, return what we have or empty
            }
            return data.text;
        } catch (err) {
            throw new Error('Failed to parse PDF: ' + err.message);
        }
    }

    async parseDOCX(filePath) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (err) {
            throw new Error('Failed to parse DOCX: ' + err.message);
        }
    }

    async parseImage(filePath) {
        let cleanupPath = null;
        try {
            let ocrPath = filePath;
            try {
                const sharp = require('sharp');
                cleanupPath = `${filePath}.ocr.png`;
                await sharp(filePath)
                    .rotate()
                    .resize({ width: 1800, withoutEnlargement: true })
                    .grayscale()
                    .normalize()
                    .sharpen()
                    .png()
                    .toFile(cleanupPath);
                ocrPath = cleanupPath;
            } catch (prepErr) {
                console.warn('[ResumeParser] Image preprocessing skipped:', prepErr.message);
            }

            const { data: { text } } = await Tesseract.recognize(ocrPath, 'eng', {
                tessedit_pageseg_mode: '6',
                preserve_interword_spaces: '1'
            });
            return text;
        } catch (err) {
            throw new Error('OCR Failed: ' + err.message);
        } finally {
            if (cleanupPath) {
                try { fs.unlinkSync(cleanupPath); } catch (_e) { }
            }
        }
    }
}

module.exports = new ResumeParserService();
