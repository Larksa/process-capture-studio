/**
 * Test script for export functionality
 * Run this in the browser console to test exports
 */

// Test export functionality
function testExport() {
    console.log('🧪 Starting Export Test...');
    
    // Check if app is available
    if (!window.app) {
        console.error('❌ App not initialized');
        return;
    }
    
    // Check if engine has data
    const engine = window.app.engine;
    if (!engine) {
        console.error('❌ ProcessEngine not initialized');
        return;
    }
    
    console.log(`📊 Current state:
    - Nodes: ${engine.process.nodes.size}
    - Edges: ${engine.process.edges.length}
    - Has unsaved changes: ${engine.hasUnsavedChanges}`);
    
    if (engine.process.nodes.size === 0) {
        console.log('⚠️ No nodes to export. Creating test data...');
        
        // Create some test nodes
        engine.createNode({
            actionType: 'click',
            description: 'Test Click Action',
            application: 'chrome',
            windowTitle: 'Test Window'
        });
        
        engine.createNode({
            actionType: 'type',
            description: 'Test Type Action',
            input: {
                value: 'Hello World',
                valueType: 'text'
            }
        });
        
        console.log('✅ Created 2 test nodes');
    }
    
    // Test each export format
    const formats = ['json', 'yaml', 'mermaid', 'playwright', 'python', 'documentation'];
    
    formats.forEach(format => {
        console.log(`\n🔍 Testing ${format} export...`);
        
        try {
            const result = engine.exportForAutomation(format);
            
            if (!result || result.trim() === '') {
                console.error(`❌ ${format}: Empty result`);
            } else {
                console.log(`✅ ${format}: Generated ${result.length} characters`);
                
                // Show first 200 chars as preview
                const preview = result.substring(0, 200);
                console.log(`Preview: ${preview}...`);
            }
        } catch (error) {
            console.error(`❌ ${format}: Error - ${error.message}`);
        }
    });
    
    console.log('\n✅ Export test complete!');
}

// Run test automatically if in browser
if (typeof window !== 'undefined') {
    console.log('💡 Run testExport() to test export functionality');
    
    // Make function available globally
    window.testExport = testExport;
}