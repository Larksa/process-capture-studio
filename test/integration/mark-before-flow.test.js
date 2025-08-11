/**
 * Integration Tests for Complete Mark Before Flow
 * Tests the interaction between mark handler, IPC, and UI
 */

const MarkBeforeHandler = require('../../src/main/mark-before-handler');
const EventGenerator = require('../utils/event-generator');

describe('Mark Before Complete Flow', () => {
  let handler;
  let eventGen;
  let mockWindow;
  let mockIPC;
  let capturedMessages = [];

  beforeEach(() => {
    // Reset captured messages
    capturedMessages = [];

    // Create more realistic mock window
    mockWindow = {
      webContents: {
        send: jest.fn((channel, data) => {
          capturedMessages.push({ channel, data });
        })
      },
      isDestroyed: jest.fn(() => false)
    };

    // Mock IPC for integration
    mockIPC = {
      emit: jest.fn(),
      on: jest.fn()
    };

    handler = new MarkBeforeHandler();
    handler.init(mockWindow);
    eventGen = new EventGenerator();
  });

  describe('Complete User Workflow', () => {
    test('Full workflow: Start → Type → Done → Save', () => {
      // Step 1: User presses Ctrl+Shift+M to start
      handler.startMarkMode();
      
      // Verify start message sent
      const startMsg = capturedMessages.find(m => m.channel === 'mark:mode-started');
      expect(startMsg).toBeDefined();
      expect(handler.isActive()).toBe(true);
      
      // Step 2: User types "hello world" in Notion
      const typingEvents = eventGen.typingScenario('hello world', 'Notion');
      typingEvents.forEach(event => handler.processEvent(event));
      
      // Verify status updates sent
      const statusUpdates = capturedMessages.filter(m => m.channel === 'mark:status-update');
      expect(statusUpdates.length).toBeGreaterThan(0);
      
      // Verify text captured
      expect(handler.getCurrentText()).toBe('hello world');
      
      // Step 3: User clicks Done (or presses special key combo)
      const result = handler.stopMarkMode('done-button');
      
      // Verify stop message sent
      const stopMsg = capturedMessages.find(m => m.channel === 'mark:mode-stopped');
      expect(stopMsg).toBeDefined();
      expect(stopMsg.data).toMatchObject({
        type: 'marked-action',
        capturedText: 'hello world',
        summary: 'Typed: "hello world"',
        completionReason: 'done-button'
      });
      
      // Step 4: Verify data ready for save
      expect(result.events).toHaveLength(typingEvents.length);
      expect(result.events[0].application).toBe('Notion');
    });

    test('Workflow with context preservation', () => {
      // Start in specific app context
      handler.startMarkMode('Adding customer note');
      
      // Simulate typing in CRM application
      const events = [
        eventGen.click(400, 300, { app: 'Salesforce CRM' }),
        ...eventGen.typeText('Customer requested refund', { app: 'Salesforce CRM' }),
        ...eventGen.enter(),
        ...eventGen.typeText('Processing immediately', { app: 'Salesforce CRM' })
      ];
      
      events.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('done');
      
      // Verify context preserved
      expect(result.description).toBe('Adding customer note');
      expect(result.capturedText).toBe('Customer requested refund\nProcessing immediately');
      expect(result.events.every(e => e.application === 'Salesforce CRM')).toBe(true);
    });

    test('Cancel workflow', () => {
      handler.startMarkMode();
      
      // Type something
      eventGen.typeText('test').forEach(e => handler.processEvent(e));
      
      // Press Escape to cancel
      eventGen.escape().forEach(e => handler.processEvent(e));
      
      // Verify cancelled
      expect(handler.isActive()).toBe(false);
      
      const stopMsg = capturedMessages.find(m => m.channel === 'mark:mode-stopped');
      expect(stopMsg.data.completionReason).toBe('cancelled');
    });
  });

  describe('Error Scenarios', () => {
    test('Handle no events captured', () => {
      handler.startMarkMode();
      
      // Don't capture anything, just stop
      const result = handler.stopMarkMode('done');
      
      expect(result.events).toHaveLength(0);
      expect(result.summary).toBeDefined();
      expect(result.capturedText).toBeUndefined();
    });

    test('Handle timeout scenario', (done) => {
      handler.maxCaptureDuration = 50; // Very short timeout
      handler.startMarkMode();
      
      // Start typing but don't finish
      eventGen.typeText('incomple').forEach(e => handler.processEvent(e));
      
      setTimeout(() => {
        // Should auto-complete
        expect(handler.isActive()).toBe(false);
        
        const stopMsg = capturedMessages.find(m => m.channel === 'mark:mode-stopped');
        expect(stopMsg.data.completionReason).toBe('timeout-30s');
        expect(stopMsg.data.capturedText).toBe('incomple');
        done();
      }, 100);
    });

    test('Handle rapid mode switches', () => {
      // Start first session
      handler.startMarkMode();
      eventGen.typeText('first').forEach(e => handler.processEvent(e));
      
      // Immediately start second session (like double-pressing shortcut)
      const firstResult = handler.stopMarkMode('new-mark-started');
      handler.startMarkMode();
      eventGen.typeText('second').forEach(e => handler.processEvent(e));
      
      const secondResult = handler.stopMarkMode('done');
      
      // Both should have correct data
      expect(firstResult.capturedText).toBe('first');
      expect(secondResult.capturedText).toBe('second');
    });
  });

  describe('Real-World Scenarios', () => {
    test('Data entry workflow', () => {
      handler.startMarkMode('Entering invoice data');
      
      const workflow = [
        // Click invoice number field
        eventGen.click(200, 150, { app: 'QuickBooks' }),
        // Type invoice number
        ...eventGen.typeText('INV-2024-001', { app: 'QuickBooks' }),
        // Tab to next field
        { type: 'keydown', rawcode: 15, application: 'QuickBooks' }, // Tab
        // Type amount
        ...eventGen.typeText('1500.00', { app: 'QuickBooks' }),
        // Tab to description
        { type: 'keydown', rawcode: 15, application: 'QuickBooks' },
        // Type description
        ...eventGen.typeText('Consulting services', { app: 'QuickBooks' })
      ];
      
      workflow.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('done');
      
      // Should capture all the text fields
      expect(result.capturedText).toContain('INV-2024-001');
      expect(result.capturedText).toContain('1500.00');
      expect(result.capturedText).toContain('Consulting services');
    });

    test('Copy-paste workflow', () => {
      handler.startMarkMode('Copying data from Excel to web form');
      
      const workflow = [
        // Click in Excel
        eventGen.click(300, 200, { app: 'Excel' }),
        // Ctrl+C to copy
        { type: 'keydown', keychar: 'c', ctrlKey: true, application: 'Excel' },
        // Click in browser
        eventGen.click(500, 300, { app: 'Chrome' }),
        // Ctrl+V to paste
        { type: 'keydown', keychar: 'v', ctrlKey: true, application: 'Chrome' },
        // Type additional notes
        ...eventGen.typeText(' - verified', { app: 'Chrome' })
      ];
      
      workflow.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('done');
      
      // Should show mixed application usage
      const apps = [...new Set(result.events.map(e => e.application))];
      expect(apps).toContain('Excel');
      expect(apps).toContain('Chrome');
      expect(result.capturedText).toBe(' - verified');
    });

    test('Form submission workflow', () => {
      handler.startMarkMode('Submitting support ticket');
      
      const workflow = [
        // Type subject
        ...eventGen.typeText('Login issue', { app: 'ServiceNow' }),
        // Tab to description
        { type: 'keydown', rawcode: 15, application: 'ServiceNow' },
        // Type description
        ...eventGen.typeText('User cannot login with correct credentials', { app: 'ServiceNow' }),
        // Click submit button
        eventGen.click(600, 500, { app: 'ServiceNow' })
      ];
      
      workflow.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('form-submitted');
      
      expect(result.capturedText).toContain('Login issue');
      expect(result.capturedText).toContain('User cannot login');
      expect(result.actionType).toBe('mixed'); // Has both typing and clicking
    });
  });

  describe('Performance', () => {
    test('Handle large number of events efficiently', () => {
      handler.startMarkMode();
      
      const startTime = Date.now();
      
      // Generate lots of events
      const longText = 'a'.repeat(500);
      const events = eventGen.typeText(longText);
      
      events.forEach(event => handler.processEvent(event));
      
      const processingTime = Date.now() - startTime;
      
      // Should process reasonably quickly (under 1 second for 500 chars)
      expect(processingTime).toBeLessThan(1000);
      
      const result = handler.stopMarkMode('done');
      expect(result.events).toHaveLength(1000); // 500 chars * 2 events each
      expect(result.capturedText).toHaveLength(500);
    });

    test('Memory cleanup after stop', () => {
      handler.startMarkMode();
      
      // Capture many events
      const events = eventGen.typeText('test data for memory check');
      events.forEach(event => handler.processEvent(event));
      
      // Stop and check cleanup
      handler.stopMarkMode('done');
      
      expect(handler.capturedEvents).toHaveLength(0);
      expect(handler.currentText).toBe('');
      expect(handler.isActive()).toBe(false);
    });
  });
});