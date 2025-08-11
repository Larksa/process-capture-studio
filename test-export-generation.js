// Test script to verify export generation with events array
// Run this in the browser console after capturing a marked action

// Create a test marked action with events
const testNode = {
    id: 'test-marked-action',
    type: 'marked-action',
    description: 'Creating ActiveCampaign automation',
    context: 'Setting up email workflow',
    data: {
        events: [
            {
                type: 'click',
                element: {
                    id: 'ember1283',
                    tagName: 'BUTTON',
                    text: 'Create New',
                    selectors: {
                        id: '#ember1283',
                        css: 'button.create-new',
                        xpath: '//button[@id="ember1283"]'
                    }
                },
                x: 450,
                y: 200,
                pageContext: {
                    url: 'https://app.activecampaign.com/automations'
                }
            },
            {
                type: 'typed_text',
                text: 'Welcome Email Series'
            },
            {
                type: 'click',
                element: {
                    tagName: 'INPUT',
                    type: 'text',
                    name: 'automation_name',
                    selectors: {
                        id: '#automation-name',
                        css: 'input[name="automation_name"]'
                    }
                },
                x: 300,
                y: 250
            },
            {
                type: 'typed_text',
                text: 'Test Automation'
            },
            {
                type: 'keystroke',
                key: 'Enter'
            }
        ],
        subSteps: [
            {
                id: 'substep-1',
                name: 'Navigate to Automations',
                eventIndices: [0]
            },
            {
                id: 'substep-2',
                name: 'Name the automation',
                eventIndices: [1, 2, 3]
            },
            {
                id: 'substep-3',
                name: 'Submit form',
                eventIndices: [4]
            }
        ]
    }
};

// Test each export format
console.log('=== Testing Export Generation ===\n');

// Test Playwright export
console.log('--- PLAYWRIGHT EXPORT ---');
if (window.processEngine) {
    // Add test node to engine
    window.processEngine.process.nodes.set(testNode.id, testNode);
    
    const playwrightCode = window.processEngine.generatePlaywrightCode();
    console.log(playwrightCode);
    
    console.log('\n--- PUPPETEER EXPORT ---');
    const puppeteerCode = window.processEngine.generatePuppeteerCode();
    console.log(puppeteerCode);
    
    console.log('\n--- SELENIUM EXPORT ---');
    const seleniumCode = window.processEngine.generateSeleniumCode();
    console.log(seleniumCode);
    
    console.log('\n--- PYTHON EXPORT ---');
    const pythonCode = window.processEngine.generatePythonCode();
    console.log(pythonCode);
    
    // Test export via exportForAutomation
    console.log('\n--- Testing exportForAutomation ---');
    console.log('Playwright:', window.processEngine.exportForAutomation('playwright').substring(0, 200) + '...');
    console.log('Puppeteer:', window.processEngine.exportForAutomation('puppeteer').substring(0, 200) + '...');
    console.log('Selenium:', window.processEngine.exportForAutomation('selenium').substring(0, 200) + '...');
    console.log('Python:', window.processEngine.exportForAutomation('python').substring(0, 200) + '...');
} else {
    console.error('ProcessEngine not found! Make sure to expose it: window.processEngine = this.engine');
}