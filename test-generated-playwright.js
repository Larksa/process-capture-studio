
const { chromium } = require('playwright');

async function runAutomation() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Generated from Process Capture Studio
  await page.goto('https://example.com');
  await page.click('h1');
  await page.fill('input', 'test query');
  await page.click('button');
  
  await browser.close();
}

runAutomation().catch(console.error);
