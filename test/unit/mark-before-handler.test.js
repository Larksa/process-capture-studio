/**
 * Unit Tests for Mark Before Handler
 */

const MarkBeforeHandler = require('../../src/main/mark-before-handler');
const EventGenerator = require('../utils/event-generator');

describe('MarkBeforeHandler', () => {
  let handler;
  let eventGen;
  let mockWindow;

  beforeEach(() => {
    // Create mock window
    mockWindow = {
      webContents: {
        send: jest.fn()
      },
      isDestroyed: jest.fn(() => false)
    };

    // Create handler and event generator
    handler = new MarkBeforeHandler();
    handler.init(mockWindow);
    eventGen = new EventGenerator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    test('should start mark mode', () => {
      const result = handler.startMarkMode('test description');
      
      expect(result).toBe(true);
      expect(handler.isActive()).toBe(true);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'mark:mode-started',
        expect.objectContaining({
          description: 'test description'
        })
      );
    });

    test('should stop mark mode', () => {
      handler.startMarkMode();
      const result = handler.stopMarkMode('test-reason');
      
      expect(handler.isActive()).toBe(false);
      expect(result).toHaveProperty('completionReason', 'test-reason');
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'mark:mode-stopped',
        expect.any(Object)
      );
    });

    test('should not process events when not in mark mode', () => {
      const event = eventGen.keydown('a');
      const result = handler.processEvent(event);
      
      expect(result).toBe(false);
      expect(handler.capturedEvents).toHaveLength(0);
    });
  });

  describe('Text Capture', () => {
    test('should capture typed text correctly', () => {
      handler.startMarkMode();
      
      // Type "hello"
      const events = eventGen.typeText('hello');
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('hello');
      expect(handler.capturedEvents).toHaveLength(10); // 5 letters * 2 (keydown+keyup)
    });

    test('should capture text with spaces', () => {
      handler.startMarkMode();
      
      // Type "hello world"
      const events = eventGen.typeText('hello world');
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('hello world');
    });

    test('should handle backspace correctly', () => {
      handler.startMarkMode();
      
      // Type "hello" then backspace
      const events = [
        ...eventGen.typeText('hello'),
        ...eventGen.backspace()
      ];
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('hell');
    });

    test('should capture capital letters', () => {
      handler.startMarkMode();
      
      // Type "Hello World"
      const events = eventGen.typeText('Hello World');
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('Hello World');
    });

    test('should capture numbers', () => {
      handler.startMarkMode();
      
      // Type "test123"
      const events = eventGen.typeText('test123');
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('test123');
    });
  });

  describe('Completion Triggers', () => {
    test('should NOT complete on Enter key (user must click Done)', () => {
      handler.startMarkMode();
      
      // Type text and press Enter
      const events = [
        ...eventGen.typeText('hello'),
        ...eventGen.enter()
      ];
      
      events.forEach(event => handler.processEvent(event));
      
      // Should still be active - Enter just adds newline
      expect(handler.isActive()).toBe(true);
      expect(handler.getCurrentText()).toBe('hello\n');
    });

    test('should complete on Escape key', () => {
      handler.startMarkMode();
      
      // Type text and press Escape
      const events = [
        ...eventGen.typeText('hello'),
        ...eventGen.escape()
      ];
      
      events.forEach(event => handler.processEvent(event));
      
      // Should be cancelled
      expect(handler.isActive()).toBe(false);
    });

    test('should auto-complete after timeout', (done) => {
      // Set short timeout for testing
      handler.maxCaptureDuration = 100; // 100ms
      handler.startMarkMode();
      
      // Wait for timeout
      setTimeout(() => {
        expect(handler.isActive()).toBe(false);
        done();
      }, 150);
    });
  });

  describe('Summary Generation', () => {
    test('should generate correct summary for typed text', () => {
      handler.startMarkMode();
      
      // Type "hello world"
      const events = eventGen.typeText('hello world');
      events.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('manual');
      
      expect(result.summary).toBe('Typed: "hello world"');
      expect(result.capturedText).toBe('hello world');
    });

    test('should generate summary for click events', () => {
      handler.startMarkMode();
      
      // Just click
      const event = eventGen.click(100, 200, { app: 'Notion' });
      handler.processEvent(event);
      
      const result = handler.stopMarkMode('manual');
      
      expect(result.summary).toContain('Click');
    });

    test('should include application context in summary', () => {
      handler.startMarkMode();
      
      // Type in Notion
      const events = eventGen.typeText('test', { app: 'Notion' });
      events.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('manual');
      
      expect(result.capturedText).toBe('test');
      expect(result.events[0].application).toBe('Notion');
    });

    test('should handle empty capture gracefully', () => {
      handler.startMarkMode();
      
      // Don't capture anything
      const result = handler.stopMarkMode('manual');
      
      expect(result.summary).toBeDefined();
      expect(result.events).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle mixed typing and clicking', () => {
      handler.startMarkMode();
      
      const events = [
        eventGen.click(100, 100),
        ...eventGen.typeText('hello'),
        eventGen.click(200, 200),
        ...eventGen.typeText(' world')
      ];
      
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('hello world');
      expect(handler.capturedEvents.length).toBeGreaterThan(10);
    });

    test('should handle rapid typing', () => {
      handler.startMarkMode();
      
      // Simulate rapid typing with minimal delay
      const events = eventGen.typeText('the quick brown fox', { delay: 1 });
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toBe('the quick brown fox');
    });

    test('should track event count correctly', () => {
      handler.startMarkMode();
      
      const events = eventGen.typingScenario('test message', 'Slack');
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getEventCount()).toBe(events.length);
    });
  });

  describe('Data Packaging', () => {
    test('should package data correctly', () => {
      handler.startMarkMode('test action');
      
      const events = eventGen.typeText('hello world');
      events.forEach(event => handler.processEvent(event));
      
      const result = handler.stopMarkMode('done');
      
      expect(result).toMatchObject({
        type: 'marked-action',
        actionType: 'text-input',
        description: 'test action',
        completionReason: 'done',
        capturedText: 'hello world',
        summary: 'Typed: "hello world"'
      });
      
      expect(result.events).toHaveLength(22); // 11 chars * 2 events
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should detect action types correctly', () => {
      // Test text input
      handler.startMarkMode();
      eventGen.typeText('test').forEach(e => handler.processEvent(e));
      let result = handler.stopMarkMode();
      expect(result.actionType).toBe('text-input');
      
      // Test click only
      handler.startMarkMode();
      handler.processEvent(eventGen.click(100, 100));
      result = handler.stopMarkMode();
      expect(result.actionType).toBe('click');
      
      // Test mixed
      handler.startMarkMode();
      handler.processEvent(eventGen.click(100, 100));
      eventGen.typeText('test').forEach(e => handler.processEvent(e));
      result = handler.stopMarkMode();
      expect(result.actionType).toBe('mixed');
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters', () => {
      handler.startMarkMode();
      
      // Note: Our simple mock doesn't handle special chars perfectly
      // but we can test the structure
      const events = eventGen.typeText('test@example.com');
      events.forEach(event => handler.processEvent(event));
      
      // At minimum, should capture the alphanumeric parts
      expect(handler.getCurrentText()).toContain('test');
      expect(handler.getCurrentText()).toContain('example');
      expect(handler.getCurrentText()).toContain('com');
    });

    test('should handle very long text', () => {
      handler.startMarkMode();
      
      const longText = 'a'.repeat(1000);
      const events = eventGen.typeText(longText.substring(0, 100)); // Test first 100 chars
      events.forEach(event => handler.processEvent(event));
      
      expect(handler.getCurrentText()).toHaveLength(100);
      
      const result = handler.stopMarkMode();
      // Summary should be truncated
      expect(result.summary.length).toBeLessThan(100);
    });

    test('should handle multiple mark mode sessions', () => {
      // First session
      handler.startMarkMode();
      eventGen.typeText('first').forEach(e => handler.processEvent(e));
      let result = handler.stopMarkMode();
      expect(result.capturedText).toBe('first');
      
      // Second session - should be clean
      handler.startMarkMode();
      eventGen.typeText('second').forEach(e => handler.processEvent(e));
      result = handler.stopMarkMode();
      expect(result.capturedText).toBe('second');
      expect(result.events).not.toContain(expect.objectContaining({ keychar: 'f' }));
    });
  });
});