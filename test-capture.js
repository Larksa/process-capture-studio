/**
 * Test script for uiohook-napi system-wide capture
 * Run with: node test-capture.js
 */

const CaptureService = require('./src/main/capture-service');

async function testCapture() {
    console.log('🔧 Testing system-wide capture with uiohook-napi...\n');
    
    const captureService = new CaptureService();
    
    // Set up event listeners
    captureService.on('activity', (activity) => {
        console.log(`📊 Activity: ${activity.type}`, {
            timestamp: new Date(activity.timestamp).toLocaleTimeString(),
            key: activity.key,
            application: activity.context?.application,
            important: activity.isImportant || false
        });
    });
    
    captureService.on('capture:started', () => {
        console.log('✅ Capture started successfully\n');
        console.log('Press some keys or click around to test capture...');
        console.log('Press Ctrl+C to stop the test\n');
    });
    
    captureService.on('capture:stopped', () => {
        console.log('\n🛑 Capture stopped');
    });
    
    try {
        // Initialize the capture service
        await captureService.initialize();
        
        // Start capturing
        captureService.startCapture();
        
        // Let it run for a bit
        setTimeout(() => {
            console.log('\n📈 Recent activities:', captureService.getRecentActivities(5));
        }, 5000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.log('\n🔍 Troubleshooting:');
        console.log('1. On macOS, make sure the terminal/app has accessibility permissions');
        console.log('2. Go to System Preferences > Security & Privacy > Privacy > Accessibility');
        console.log('3. Add Terminal.app or your Electron app to the list');
        console.log('4. Restart the application after granting permissions');
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🧹 Cleaning up...');
        captureService.stopCapture();
        captureService.cleanup();
        process.exit(0);
    });
}

// Run the test
testCapture().catch(console.error);