/**
 * Test Browser Context Capture
 * Tests the Playwright integration for capturing browser element selectors
 */

const BrowserContextService = require('./src/main/browser-context-service');

async function testBrowserContext() {
    const service = new BrowserContextService();
    
    console.log('=== Browser Context Test ===\n');
    
    // Try to connect to existing browser
    console.log('1. Attempting to connect to existing browser...');
    console.log('   (Chrome/Edge must be running with --remote-debugging-port=9222)');
    console.log('   Run: chrome --remote-debugging-port=9222');
    console.log('   Or: msedge --remote-debugging-port=9222\n');
    
    const connected = await service.connectToExistingBrowser();
    
    if (!connected) {
        console.log('❌ No existing browser found. Launching new browser...\n');
        const launched = await service.launchBrowser();
        
        if (!launched) {
            console.error('❌ Failed to launch browser. Exiting.');
            process.exit(1);
        }
        
        console.log('✅ New browser launched successfully!\n');
        
        // Navigate to a test page
        console.log('2. Navigating to example.com for testing...');
        await service.activePage.goto('https://example.com');
        console.log('✅ Page loaded\n');
    } else {
        console.log('✅ Connected to existing browser!\n');
    }
    
    // Get all open pages
    console.log('3. Getting all open pages...');
    const pages = await service.getAllPages();
    console.log(`Found ${pages.length} page(s):`);
    pages.forEach((page, i) => {
        console.log(`   ${i + 1}. ${page.title || 'Untitled'} - ${page.url}`);
    });
    console.log('');
    
    // Get current page context
    console.log('4. Getting current page context...');
    const context = await service.getPageContext();
    if (context) {
        console.log('Page Context:');
        console.log(`   URL: ${context.url}`);
        console.log(`   Title: ${context.title}`);
        console.log(`   Domain: ${context.domain}`);
        console.log(`   Viewport: ${context.viewport.width}x${context.viewport.height}`);
        console.log('');
    }
    
    // Test element detection at coordinates
    console.log('5. Testing element detection at coordinates (100, 100)...');
    const element = await service.getElementAtPoint(100, 100);
    
    if (element) {
        console.log('✅ Element found!');
        console.log('Element Details:');
        console.log(`   Tag: ${element.tag}`);
        console.log(`   Text: ${element.selectors?.text || 'N/A'}`);
        console.log(`   ID Selector: ${element.selectors?.id || 'N/A'}`);
        console.log(`   CSS Selector: ${element.selectors?.css || 'N/A'}`);
        console.log(`   XPath: ${element.selectors?.xpath || 'N/A'}`);
        console.log(`   Position: ${element.position.x}, ${element.position.y}`);
        console.log(`   Size: ${element.position.width}x${element.position.height}`);
        console.log(`   Clickable: ${element.isClickable}`);
        console.log(`   Input: ${element.isInput}`);
        
        if (element.selectors?.attributes) {
            console.log('   Attributes:');
            Object.entries(element.selectors.attributes).forEach(([key, value]) => {
                console.log(`      ${key}: ${value}`);
            });
        }
    } else {
        console.log('❌ No element found at coordinates');
    }
    
    console.log('\n6. Taking screenshot...');
    const screenshot = await service.captureScreenshot();
    if (screenshot) {
        console.log('✅ Screenshot captured (buffer size: ' + screenshot.length + ' bytes)');
    }
    
    // Keep running for manual testing
    console.log('\n=== Test Complete ===');
    console.log('Browser connection active. Press Ctrl+C to exit.\n');
    console.log('Try clicking in the browser - the app will capture element selectors!');
    
    // Monitor for page changes
    await service.monitorPages();
}

// Run test
testBrowserContext().catch(console.error);

// Keep process running
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    process.exit(0);
});