const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://strudel.cc/?embed=1');
    
    // Wait for strudel to load
    await page.waitForTimeout(5000);
    
    const result = await page.evaluate(() => {
        return new Promise((resolve) => {
            window.addEventListener('message', (e) => {
                console.log("Received:", e.data);
            });
            window.postMessage({evaluate: '$: s("bd")'}, '*');
            setTimeout(() => resolve(document.body.innerHTML.includes('bd')), 2000);
        });
    });
    
    console.log("Did it work?", result);
    await browser.close();
})();
