const fs = require('fs');
const path = require('path');
const os = require('os');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');
const { spawn, execSync } = require('child_process');

let sharedBrowserPromise = null;

/**
 * Returns a shared Puppeteer browser instance.
 *
 * The cache is invalidated when:
 *  1. browser.on('disconnected') fires – e.g. browser killed by nodemon restart
 *  2. browser.isConnected() is false when we try to reuse it
 *  3. The launch promise itself rejects
 *
 * Without this check the server suffers "Protocol error: Connection closed"
 * because nodemon kills the Chromium process on restart but the cached promise
 * still resolves to the dead browser object.
 */
async function getSharedBrowser() {
    if (sharedBrowserPromise) {
        try {
            const browser = await sharedBrowserPromise;
            if (browser.isConnected()) {
                return browser;
            }
            // Browser has disconnected (e.g. killed by nodemon restart or crash)
            appendLog('WARN: Cached Puppeteer browser is disconnected – relaunching.');
            sharedBrowserPromise = null;
        } catch (_) {
            // Previous launch failed or promise rejected; clear so we retry below
            sharedBrowserPromise = null;
        }
    }

    sharedBrowserPromise = puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }).then((browser) => {
        // Auto-clear cache the moment the browser closes or crashes
        browser.on('disconnected', () => {
            appendLog('WARN: Puppeteer browser disconnected – cache cleared for next call.');
            sharedBrowserPromise = null;
        });
        return browser;
    }).catch((error) => {
        sharedBrowserPromise = null;
        throw error;
    });

    return sharedBrowserPromise;
}

function toFileUrl(p) {
    const abs = path.resolve(p).replace(/\\/g, '/');
    return `file:///${abs.replace(/^([A-Za-z]):/, '$1:')}`;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendLog(line) {
    try {
        const logDir = path.join(process.cwd(), 'logs');
        ensureDirSync(logDir);
        fs.appendFileSync(path.join(logDir, 'libreoffice.log'), `[${new Date().toISOString()}] ${line}\n`);
    } catch {
        // ignore
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildReadableDocxHtml(bodyHtml, options = {}) {
    const title = escapeHtml(options.title || 'Letter');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, Calibri, "Segoe UI", sans-serif;
            font-size: 11pt;
            line-height: 1.5;
        }

        .pdf-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm 18mm 16mm;
            background: #ffffff;
        }

        p {
            margin: 0 0 8pt;
        }

        h1,
        h2,
        h3,
        h4 {
            margin: 12pt 0 8pt;
            line-height: 1.25;
            color: #111827;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10pt 0;
            page-break-inside: auto;
        }

        tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }

        td,
        th {
            border: 1px solid #111827;
            padding: 6pt;
            vertical-align: top;
            word-break: break-word;
        }

        ul,
        ol {
            margin: 0 0 8pt 18pt;
            padding-left: 14pt;
        }

        li {
            margin-bottom: 4pt;
        }

        img {
            max-width: 100%;
            height: auto;
        }

        a {
            color: inherit;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <main class="pdf-page">
        ${bodyHtml || ''}
    </main>
</body>
</html>`;
}

function resolveSofficePath() {
    const envPath = process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidates = [
        'C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.exe',
        'C:\\\\Program Files (x86)\\\\LibreOffice\\\\program\\\\soffice.exe',
        'C:\\\\ProgramData\\\\chocolatey\\\\lib\\\\libreoffice-fresh\\\\tools\\\\LibreOffice\\\\program\\\\soffice.exe',
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;

    try {
        const out = execSync('where soffice', { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).toString().trim();
        const first = out.split(/\r?\n/).find(Boolean);
        if (first && fs.existsSync(first)) return first;
    } catch { /* ignore */ }

    return null;
}

async function killLibreOfficeProcessesBestEffort() {
    // [STABILITY] Kill any existing soffice processes that might be hanging
    // On Windows, LibreOffice is notoriously bad with parallel runs or stale locks.
    try {
        if (os.platform() === 'win32') {
            execSync('taskkill /F /IM soffice.exe /T', { stdio: 'ignore', windowsHide: true });
            execSync('taskkill /F /IM soffice.bin /T', { stdio: 'ignore', windowsHide: true });
        }
    } catch {
        // ignore errors (like process not found)
    }
}


class LibreOfficeService {
    constructor() {
        this.queue = Promise.resolve();
        this.sharedProfileDir = path.join(os.tmpdir(), 'hrms_libreoffice_shared_profile');
        ensureDirSync(this.sharedProfileDir);

        // console.log('✅ [LibreOfficeService] Initialized (High Fidelity Shell Mode)');
        
        // [STABILITY] Clean up any stale LibreOffice processes left behind by previous server crashes or restarts
        try {
            if (os.platform() === 'win32') {
                execSync('taskkill /F /IM soffice.exe /T', { stdio: 'ignore', windowsHide: true });
                execSync('taskkill /F /IM soffice.bin /T', { stdio: 'ignore', windowsHide: true });
            }
        } catch (_) {
            // ignore
        }

        // Clean lock file at startup if any exists
        const lockFilePath = path.join(this.sharedProfileDir, '.lock');
        if (fs.existsSync(lockFilePath)) {
            try {
                fs.unlinkSync(lockFilePath);
            } catch (_) {
                // ignore
            }
        }

        if (process.env.PUPPETEER_PREWARM !== 'false') {
            setImmediate(() => getSharedBrowser().catch((error) => {
                appendLog(`WARN: puppeteer prewarm failed="${error.message}"`);
            }));
        }
    }

    /**
     * Convert DOCX to PDF using LibreOffice (soffice) for high fidelity.
     * Fallback to Mammoth + Puppeteer if LibreOffice is missing.
     */
    async convertToPdf(inputPath, outputDir) {
        // Queue the execution sequentially to avoid concurrent access to the shared profile
        return new Promise((resolve, reject) => {
            this.queue = this.queue.then(async () => {
                try {
                    const result = await this._convertToPdfInternal(inputPath, outputDir);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }).catch((err) => {
                // Ensure queue chain never stalls
                reject(err);
            });
        });
    }

    async _convertToPdfInternal(inputPath, outputDir) {
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Input file not found: ${inputPath}`);
        }

        if (!fs.existsSync(outputDir)) {
            await fs.promises.mkdir(outputDir, { recursive: true });
        }

        const ext = path.extname(inputPath).toLowerCase();
        const isHtml = ext === '.html' || ext === '.htm';

        // [OPTIMIZATION] For HTML files, use Puppeteer directly for 1-second performance.
        // LibreOffice is much slower for HTML-to-PDF.
        if (isHtml) {
            return await this.convertHtmlToPdfFallback(inputPath, outputDir);
        }

        const baseName = path.basename(inputPath, ext);
        const expectedPdfPath = path.join(outputDir, `${baseName}.pdf`);

        const sofficeExe = resolveSofficePath();
        if (!sofficeExe) {
            appendLog(`WARN: soffice.exe not found; falling back. input="${inputPath}"`);
            return await this.convertToPdfFallback(inputPath, outputDir);
        }

        const maxAttempts = 2;
        const timeoutMs = Number(process.env.LIBREOFFICE_TIMEOUT_MS || 45000);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const profileDir = this.sharedProfileDir;
            ensureDirSync(profileDir);
            const userProfile = toFileUrl(profileDir);

            // Clean lock file before spawn on each attempt
            const lockFilePath = path.join(profileDir, '.lock');
            if (fs.existsSync(lockFilePath)) {
                try {
                    fs.unlinkSync(lockFilePath);
                    appendLog(`INFO: Removed stale lock file at ${lockFilePath} (attempt ${attempt})`);
                } catch (err) {
                    appendLog(`WARN: Could not remove lock file at ${lockFilePath}: ${err.message}`);
                }
            }

            const args = [
                `-env:UserInstallation=${userProfile}`,
                '--headless',
                '--norestore',
                '--nolockcheck',
                '--nologo',
                '--nodefault',
                '--convert-to', 'pdf',
                '--outdir', outputDir,
                inputPath
            ];

            // console.log(`🔄 [PDFService] LibreOffice attempt ${attempt}/${maxAttempts}: ${path.basename(inputPath)}`);
            appendLog(`INFO: attempt=${attempt} soffice="${sofficeExe}" input="${inputPath}" outdir="${outputDir}" profile="${profileDir}"`);

            let stdout = '';
            let stderr = '';

            try {
                // Note: killLibreOfficeProcessesBestEffort() is intentionally NOT called here on the
                // first attempt. Killing all soffice.exe processes upfront adds 1-3 seconds on every
                // generation. We only kill on failure/retry (see catch block below).

                const child = spawn(sofficeExe, args, { windowsHide: true });
                child.stdout.on('data', (d) => { stdout += d.toString(); });
                child.stderr.on('data', (d) => { stderr += d.toString(); });

                const exitCode = await new Promise((resolve, reject) => {
                    const t = setTimeout(async () => {
                        try {
                            if (os.platform() === 'win32') {
                                execSync(`taskkill /F /PID ${child.pid} /T`, { stdio: 'ignore', windowsHide: true });
                            } else {
                                child.kill('SIGKILL');
                            }
                        } catch { /* ignore */ }
                        reject(new Error(`LibreOffice timed out after ${timeoutMs}ms`));
                    }, timeoutMs);

                    child.on('error', (e) => {
                        clearTimeout(t);
                        reject(e);
                    });
                    child.on('close', (code) => {
                        clearTimeout(t);
                        resolve(code);
                    });
                });

                appendLog(`INFO: exitCode=${exitCode} stdout="${stdout.trim()}" stderr="${stderr.trim()}"`);

                if (exitCode !== 0) {
                    throw new Error(`LibreOffice exited with code ${exitCode}. ${stderr || stdout}`.trim());
                }

                if (fs.existsSync(expectedPdfPath)) return expectedPdfPath;

                const pdfCandidates = (await fs.promises.readdir(outputDir))
                    .filter((f) => f.toLowerCase().endsWith('.pdf'))
                    .map((f) => path.join(outputDir, f));
                if (pdfCandidates.length) {
                    pdfCandidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
                    return pdfCandidates[0];
                }
                throw new Error('LibreOffice finished but output PDF not found.');
            } catch (cmdError) {
                const msg = cmdError?.message || String(cmdError);
                console.error('❌ [LibreOffice] Conversion failed:', msg);
                appendLog(`ERROR: ${msg} stderr="${stderr.trim()}" stdout="${stdout.trim()}"`);

                if (attempt < maxAttempts) {
                    await killLibreOfficeProcessesBestEffort();
                    await sleep(400);
                    continue;
                }

                console.warn('⚠️ [LibreOffice] Falling back to pure Node.js PDF generation.');
                return isHtml
                    ? await this.convertHtmlToPdfFallback(inputPath, outputDir)
                    : await this.convertToPdfFallback(inputPath, outputDir);
            }
        }

        return isHtml
            ? await this.convertHtmlToPdfFallback(inputPath, outputDir)
            : await this.convertToPdfFallback(inputPath, outputDir);
    }

    /**
     * Fallback method using Mammoth + Puppeteer (Pure Node.js)
     * Lower fidelity (loses headers/footers/strict layouts)
     */
    async convertToPdfFallback(inputPath, outputDir) {
        try {
            console.log(`🔄 [PDFService] Running Fallback conversion (Mammoth): ${path.basename(inputPath)}`);

            const result = await mammoth.convertToHtml({ path: inputPath });
            const html = result.value;

            const browser = await getSharedBrowser();
            const page = await browser.newPage();

            // Note: Google Fonts @import removed intentionally — it caused network requests
            // during PDF generation that added 2-5 seconds of latency on every fallback.
            const styledHtml = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { 
                                font-family: 'Calibri', 'Arial', 'Segoe UI', sans-serif; 
                                padding: 25mm; 
                                line-height: 1.5; 
                                font-size: 11pt;
                                color: #000;
                            }
                            p { margin-bottom: 10px; }
                            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                            img { max-width: 100%; }
                        </style>
                    </head>
                    <body>${html}</body>
                </html>
            `;

            // Use 'domcontentloaded' instead of 'networkidle0' — avoids waiting for any
            // external resources (fonts, images) which can add 3-10 seconds of blocking time.
            await page.setContent(styledHtml, { waitUntil: 'domcontentloaded' });

            const baseName = path.basename(inputPath, path.extname(inputPath));
            const pdfPath = path.join(outputDir, `${baseName}.pdf`);

            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true,
                margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
            });

            await page.close().catch(() => null);
            return pdfPath;
        } catch (err) {
            console.error('❌ [PDFService] Fallback Failed:', err.message);
            throw err;
        }
    }

    /**
     * Convert DOCX to a Chrome-safe PDF. LibreOffice can sometimes export a
     * valid PDF with broken embedded font glyphs on Windows, which renders as
     * garbled/CJK-looking text in Chrome. This path normalizes DOCX content to
     * HTML and lets Chromium render it with browser-safe fonts.
     */
    async convertDocxToReadablePdf(inputPath, outputDir, options = {}) {
        try {
            appendLog(`INFO: readable-docx-pdf input="${inputPath}" outdir="${outputDir}"`);
            const result = await mammoth.convertToHtml(
                { path: inputPath },
                {
                    convertImage: mammoth.images.imgElement(async (image) => ({
                        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`
                    }))
                }
            );

            if (result.messages?.length) {
                appendLog(`WARN: mammoth messages=${JSON.stringify(result.messages.slice(0, 5))}`);
            }

            const baseName = path.basename(inputPath, path.extname(inputPath));
            const htmlPath = path.join(outputDir, `${baseName}.html`);
            await fs.promises.writeFile(htmlPath, buildReadableDocxHtml(result.value, options), 'utf-8');
            return await this.convertHtmlToPdfFallback(htmlPath, outputDir);
        } catch (err) {
            appendLog(`ERROR: readable-docx-pdf failed="${err.message}"`);
            throw err;
        }
    }

    async convertHtmlToPdfFallback(inputPath, outputDir) {
        let page;
        try {
            const html = await fs.promises.readFile(inputPath, 'utf-8');
            const browser = await getSharedBrowser();
            page = await browser.newPage();
            page.setDefaultTimeout(30000);
            await page.emulateMediaType('print');

            // Avoid networkidle0 here. Some templates reference remote fonts/images,
            // and waiting for network idle can make PDF generation feel stuck.
            // Use 'domcontentloaded' to avoid blocking on external font/image loads.
            // Google Fonts and remote images can add 2-8 seconds; local content is ready at DOMContentLoaded.
            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
            // Give fonts a short fixed timeout instead of waiting indefinitely for document.fonts.ready
            await new Promise(r => setTimeout(r, 150));

            const baseName = path.basename(inputPath, path.extname(inputPath));
            const pdfPath = path.join(outputDir, `${baseName}.pdf`);

            // [STABILITY] Zero margins here because our Letter Controller HTML already 
            // defines margins via @page { margin: 0; } and internal padding.
            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true,
                margin: { top: '0', bottom: '0', left: '0', right: '0' },
                preferCSSPageSize: true
            });

            // console.log(`✅ [PDFService] Puppeteer Conversion Successful: ${pdfPath}`);
            return pdfPath;
        } catch (err) {
            console.error('❌ [PDFService] HTML fallback failed:', err.message);
            throw err;
        } finally {
            if (page) {
                try { await page.close(); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Convert DOCX to HTML (Simple preview)
     */
    async convertToHtmlAsync(inputPath, outputDir) {
        try {
            const result = await mammoth.convertToHtml({ path: inputPath });
            const baseName = path.basename(inputPath, path.extname(inputPath));
            const htmlPath = path.join(outputDir, `${baseName}.html`);
            await fs.promises.writeFile(htmlPath, result.value, 'utf-8');
            return htmlPath;
        } catch (error) {
            console.error('❌ [PDFService] HTML Conversion Failed:', error.message);
            throw error;
        }
    }
}

module.exports = new LibreOfficeService();
