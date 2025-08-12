#!/usr/bin/env node

/**
 * Test Process Capture Studio with a real news website
 * Simulates user browsing and menu interaction
 */

const { chromium } = require('playwright');

async function testNewsCapture() {
    console.log('=== Testing Process Capture Studio with News Site ===\n');
    console.log('Make sure Process Capture Studio is running (npm run dev)\n');
    
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Connected to Chrome via CDP on port 9222');
    
    const contexts = browser.contexts();
    const page = contexts[0] ? await contexts[0].pages()[0] : await browser.newPage();
    
    console.log('📍 Navigating to BBC News...');
    await page.goto('https://www.bbc.com/news');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Wait a moment for Process Capture Studio to detect the navigation
    await page.waitForTimeout(2000);
    
    console.log('🖱️ Looking for menu button...');
    
    // Try to find and click the menu button (hamburger menu)
    try {
        // BBC News usually has a menu button with aria-label
        const menuSelectors = [
            'button[aria-label*="menu"]',
            'button[aria-label*="Menu"]',
            'button.menu-button',
            '[data-testid="menu-button"]',
            'button:has-text("Menu")',
            '.hamburger-menu',
            '#orb-nav-more'  // BBC specific
        ];
        
        let menuClicked = false;
        for (const selector of menuSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`   Found menu with selector: ${selector}`);
                    await element.click();
                    menuClicked = true;
                    console.log('✅ Clicked menu button');
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }
        
        if (!menuClicked) {
            console.log('⚠️  No menu button found, clicking on navigation area...');
            // Click on the navigation area as fallback
            await page.click('nav >> nth=0').catch(() => {
                console.log('   Navigation area not found');
            });
        }
        
    } catch (error) {
        console.log('❌ Error clicking menu:', error.message);
    }
    
    // Wait for menu animation
    await page.waitForTimeout(2000);
    
    // Perform some additional actions for testing
    console.log('\n📋 Performing additional test actions...');
    
    // Scroll down
    console.log('   Scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    
    // Try to click on a news article
    try {
        const articleLink = await page.$('h2 a, h3 a');
        if (articleLink) {
            const articleText = await articleLink.textContent();
            console.log(`   Found article: "${articleText?.substring(0, 50)}..."`);
            await articleLink.hover();
            console.log('   Hovered over article');
        }
    } catch (e) {
        console.log('   No articles found to interact with');
    }
    
    console.log('\n✅ Test sequence complete!');
    console.log('\n📊 Summary of actions performed:');
    console.log('   1. Navigated to BBC News');
    console.log('   2. Clicked on menu (or navigation area)');
    console.log('   3. Scrolled down the page');
    console.log('   4. Hovered over an article');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Check Process Capture Studio UI for captured events');
    console.log('   2. Use Export button to generate automation code');
    console.log('   3. Test the generated code to verify replay works');
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser remains open for inspection.');
    console.log('   Process Capture Studio should have captured all actions.');
    console.log('   Press Ctrl+C to exit.\n');
}

// Run the test
testNewsCapture().catch(console.error);

// Keep process alive
process.on('SIGINT', () => {
    console.log('\nTest terminated by user');
    process.exit(0);
});