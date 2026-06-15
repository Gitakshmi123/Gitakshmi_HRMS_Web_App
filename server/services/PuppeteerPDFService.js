const puppeteer = require('puppeteer');

/**
 * PuppeteerPDFService
 * Generates PDF buffers dynamically from HTML content using headless Chrome.
 * Uses a warm, shared Singleton Browser instance to make PDF generation extremely fast!
 */
class PuppeteerPDFService {
    constructor() {
        this._browser = null;
    }

    /**
     * Get or Launch Warm Singleton Browser Instance
     */
    async getBrowser() {
        if (this._browser && this._browser.isConnected()) {
            return this._browser;
        }

        console.log('🚀 [PUPPETEER] Launching warm singleton browser...');
        this._browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ]
        });

        // Add handler for unexpected disconnects
        this._browser.once('disconnected', () => {
            console.log('⚠️ [PUPPETEER] Browser disconnected, will re-launch on next request');
            this._browser = null;
        });

        return this._browser;
    }

    /**
     * Generate PDF Buffer from HTML
     * @param {string} htmlContent - The full HTML content to render
     * @param {Object} options - Puppeteer PDF options
     * @returns {Promise<Buffer>} - PDF Buffer
     */
    async generatePDFBuffer(htmlContent, options = {}) {
        let page = null;
        try {
            const browser = await this.getBrowser();
            console.log('📄 [PUPPETEER] Opening new tab/page...');
            page = await browser.newPage();

            // We use networkidle2 to ensure most resources are loaded
            await page.setContent(htmlContent, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Fast wait for layouts/styles to apply
            await new Promise(r => setTimeout(r, 100));

            // Generate PDF Buffer
            console.log('📊 [PUPPETEER] Generating PDF buffer...');
            const buffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                margin: {
                    top: '15mm',
                    bottom: '15mm',
                    left: '15mm',
                    right: '15mm'
                },
                ...options
            });

            console.log(`✅ [PUPPETEER] PDF Generated successfully (${buffer.length} bytes)`);
            return buffer;
        } catch (error) {
            console.error('❌ [PUPPETEER] Error:', error.message);
            throw error;
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
            }
        }
    }

    // Alias for better developer experience
    async generatePDF(htmlContent, options = {}) {
        return this.generatePDFBuffer(htmlContent, options);
    }
}

module.exports = new PuppeteerPDFService();
