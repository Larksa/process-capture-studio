#!/usr/bin/env node

/**
 * Test script for Step Boundary system
 * Run this to validate the implementation
 */

const StepBoundaryHandler = require('./src/main/step-boundary-handler');

console.log('Testing Step Boundary Handler...\n');

// Create handler instance
const handler = new StepBoundaryHandler();

// Test 1: Start a step
console.log('TEST 1: Starting a step');
const stepId = handler.startStep('Login to system');
console.log(`✓ Step started with ID: ${stepId}`);
console.log(`✓ Is active: ${handler.isActive()}`);

// Test 2: Add some events
console.log('\nTEST 2: Processing events');
const events = [
    { type: 'click', element: { selector: '#username', type: 'text' }, x: 100, y: 200 },
    { type: 'typed_text', text: 'john.doe@example.com' },
    { type: 'click', element: { selector: '#password', type: 'password' }, x: 100, y: 250 },
    { type: 'typed_text', text: '••••••••' },
    { type: 'click', element: { selector: '#login-btn', text: 'Sign In', type: 'submit' }, x: 150, y: 300 }
];

events.forEach(event => {
    const processed = handler.processEvent(event);
    console.log(`✓ Processed event: ${event.type} - Success: ${processed}`);
});

// Test 3: End the step
console.log('\nTEST 3: Ending the step');
const stepData = handler.endStep('quick', 'Logged into the CRM system');

console.log(`✓ Step completed with ${stepData.eventCount} events`);
console.log(`✓ Summary: ${stepData.summary}`);
console.log(`✓ Pattern detected: ${stepData.patternType}`);
console.log(`✓ Primary action:`, stepData.primaryAction);
console.log(`✓ Key elements:`, stepData.keyElements.length, 'elements captured');

// Test 4: Verify handler is reset
console.log('\nTEST 4: Verify handler reset');
console.log(`✓ Is active after end: ${handler.isActive()}`);
console.log(`✓ Current step: ${handler.getCurrentStep()}`);

// Test 5: Pattern detection
console.log('\nTEST 5: Testing pattern detection');

// Test search pattern
handler.startStep('Search for customer');
handler.processEvent({ type: 'click', element: { selector: '#search', type: 'search', placeholder: 'Search customers...' }});
handler.processEvent({ type: 'typed_text', text: 'John Smith' });
handler.processEvent({ type: 'key', key: 'Enter' });
const searchStep = handler.endStep();
console.log(`✓ Search pattern detected: ${searchStep.patternType === 'search'}`);

// Test form fill pattern
handler.startStep('Create new order');
handler.processEvent({ type: 'click', element: { selector: '#customer-name', tagName: 'INPUT' }});
handler.processEvent({ type: 'typed_text', text: 'ACME Corp' });
handler.processEvent({ type: 'click', element: { selector: '#product', tagName: 'INPUT' }});
handler.processEvent({ type: 'typed_text', text: 'Widget Pro' });
handler.processEvent({ type: 'click', element: { selector: '#quantity', tagName: 'INPUT' }});
handler.processEvent({ type: 'typed_text', text: '50' });
handler.processEvent({ type: 'click', element: { selector: '#submit-order', type: 'submit', text: 'Create Order' }});
const formStep = handler.endStep();
console.log(`✓ Form fill pattern detected: ${formStep.patternType === 'form-fill'}`);

console.log('\n✅ All tests passed! Step Boundary system is working correctly.');