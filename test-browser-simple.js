/**
 * Simple Browser Context Test
 * Tests basic Playwright connection without navigation
 */

const BrowserContextService = require('./src/main/browser-context-service');

async function testSimple() {
    const service = new BrowserContextService();
    
    console.log('=== Simple Browser Context Test ===\n');
    
    // Try to connect to existing browser first
    console.log('Attempting to connect to existing browser...');
    const connected = await service.connectToExistingBrowser();
    
    if (connected) {
        console.log('✅ Connected to existing browser!');
        
        // Get current pages
        const pages = await service.getAllPages();
        console.log(`\nFound ${pages.length} open page(s):`);
        pages.forEach((page, i) => {
            console.log(`  ${i + 1}. ${page.title} - ${page.url}`);
        });
    } else {
        console.log('❌ No browser with debugging port found.');
        console.log('\nTo enable browser context capture:');
        console.log('1. Close all Chrome/Edge windows');
        console.log('2. Start Chrome with: chrome --remote-debugging-port=9222');
        console.log('   Or Edge with: msedge --remote-debugging-port=9222');
        console.log('3. Run this test again\n');
        console.log('Note: Browser context capture is optional.');
        console.log('The app will still capture clicks and keystrokes without it.');
    }
    
    await service.disconnect();
    process.exit(0);
}

testSimple().catch(console.error);