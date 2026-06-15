const puppeteer = require('puppeteer');
(async () => {
    try {
        console.log('Testing Puppeteer...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent('<h1>Hello World</h1>');
        const pdf = await page.pdf({ format: 'A4' });
        console.log('PDF Generated successfully, length:', pdf.length);
        await browser.close();
        process.exit(0);
    } catch (err) {
        console.error('Puppeteer test failed:', err);
        process.exit(1);
    }
})();
