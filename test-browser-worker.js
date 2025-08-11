/**
 * Test Browser Context Worker Integration
 * 
 * This script tests the browser context worker process
 * to ensure it can capture DOM elements correctly.
 */

const { fork } = require('child_process');
const path = require('path');

// Create a simple message ID generator
let messageId = 0;
const pendingMessages = new Map();

// Start the worker
console.log('Starting browser context worker...');
const worker = fork(path.join(__dirname, 'src/main/browser-context-worker.js'), [], {
    silent: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
});

// Handle messages from worker
worker.on('message', (message) => {
    const { id, type, success, data, error, event } = message;
    
    if (type === 'response') {
        const callback = pendingMessages.get(id);
        if (callback) {
            pendingMessages.delete(id);
            if (success) {
                callback.resolve(data);
            } else {
                callback.reject(new Error(error));
            }
        }
    } else if (type === 'event') {
        console.log(`Worker event: ${event}`, data);
    }
});

// Handle worker errors
worker.on('error', (error) => {
    console.error('Worker error:', error);
});

// Handle worker exit
worker.on('exit', (code, signal) => {
    console.log(`Worker exited with code ${code} and signal ${signal}`);
    process.exit(code);
});

// Send message to worker
function sendToWorker(type, data = {}) {
    return new Promise((resolve, reject) => {
        const id = ++messageId;
        pendingMessages.set(id, { resolve, reject });
        
        // Set timeout
        setTimeout(() => {
            if (pendingMessages.has(id)) {
                pendingMessages.delete(id);
                reject(new Error('Request timeout'));
            }
        }, 5000);
        
        worker.send({ id, type, data });
    });
}

// Run tests
async function runTests() {
    console.log('\n=== Testing Browser Context Worker ===\n');
    
    try {
        // Test 1: Connect to browser
        console.log('1. Testing connection...');
        const connectResult = await sendToWorker('connect');
        console.log('   ✅ Connected:', connectResult);
        
        // Wait a moment for browser to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 2: Get status
        console.log('\n2. Testing status...');
        const status = await sendToWorker('status');
        console.log('   ✅ Status:', status);
        
        // Test 3: Get all pages
        console.log('\n3. Testing getAllPages...');
        const pages = await sendToWorker('getAllPages');
        console.log('   ✅ Found', pages.length, 'page(s)');
        pages.forEach((page, i) => {
            console.log(`      ${i + 1}. ${page.title || 'Untitled'} - ${page.url}`);
        });
        
        // Test 4: Get page context
        console.log('\n4. Testing getPageContext...');
        const pageContext = await sendToWorker('getPageContext');
        console.log('   ✅ Page context:', pageContext);
        
        // Test 5: Test element capture (mock coordinates)
        console.log('\n5. Testing getElementAtPoint...');
        console.log('   Note: This will capture whatever is at coordinates (100, 100) on the active page');
        const elementData = await sendToWorker('getElementAtPoint', { x: 100, y: 100 });
        
        if (elementData && elementData.element) {
            console.log('   ✅ Element captured:');
            console.log('      Selector:', elementData.element.selectors?.css);
            console.log('      Tag:', elementData.element.tag);
            console.log('      Text:', elementData.element.selectors?.text);
            console.log('      URL:', elementData.pageContext?.url);
        } else {
            console.log('   ⚠️  No element found at coordinates');
        }
        
        // Test 6: Disconnect
        console.log('\n6. Testing disconnect...');
        const disconnectResult = await sendToWorker('disconnect');
        console.log('   ✅ Disconnected:', disconnectResult);
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
    
    // Cleanup
    console.log('\nCleaning up...');
    worker.kill('SIGTERM');
    process.exit(0);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, cleaning up...');
    worker.kill('SIGTERM');
    process.exit(0);
});

// Run the tests
console.log('Starting tests in 2 seconds...');
console.log('Make sure Chrome or Edge is running with: --remote-debugging-port=9222');
console.log('Example: chrome --remote-debugging-port=9222');
console.log('');

setTimeout(runTests, 2000);