const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const spawn = require('child_process');
const password = process.env.USER_PASSWORD;

/**
 * Professional Letter PDF Generator for HRMS
 * Uses pdf-lib to embed screenshot images into PDF.
 */
class LetterPDFGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '../uploads/offers');
    }


    /**
     * Generate PDF from Image Data (Screenshot)
     * @param {string} imageData - Base64 PNG data of the preview screenshot
    */
    async generatePDF(imageData, options = {}) {
        try {

            if (!password) {
                console.log('User password not found - Generating pdf without password');
            }
            await this.ensureOutputDirectory();

            // 1. Create PDF Document
            const pdfDoc = await PDFDocument.create();

            // 2. Decode Base64 Image
            const imageBytes = Buffer.from(imageData.replace(/^data:image\/png;base64,/, ''), 'base64');
            const image = await pdfDoc.embedPng(imageBytes);

            // 3. Add Page (A4 Size)
            const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points (72 DPI)

            // 4. Draw Image on Page (Full Size, No Margins)
            const { width, height } = page.getSize();
            page.drawImage(image, {
                x: 0,
                y: 0,
                width,
                height,
            });

            // 5. Serialize PDF
            const pdfBytes = await pdfDoc.save();

            // 6. Save to Disk
            const filename = this.generateFilename();
            const filePath = path.join(this.outputDir, filename);
            await fs.writeFile(filePath, pdfBytes);

            return {
                success: true,
                filename,
                downloadUrl: `/uploads/offers/${filename}`
            };

        } catch (error) {
            console.error('❌ [PDF Generator] Error:', error);
            throw error;
        }
    }

    ensureOutputDirectory() {
        return fs.mkdir(this.outputDir, { recursive: true });
    }

    generateFilename() {
        return `Offer_Screenshot_${Date.now()}.pdf`;
    }
}

module.exports = new LetterPDFGenerator();
