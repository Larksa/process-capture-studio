/**
 * Mock Event Generator for Testing
 * Generates realistic uiohook-style events for testing
 */

class EventGenerator {
  constructor() {
    this.timestamp = Date.now();
  }

  /**
   * Generate a keydown event
   */
  keydown(char, options = {}) {
    const event = {
      type: 'keydown',
      timestamp: this.timestamp++,
      keychar: typeof char === 'string' && char.length === 1 ? char : undefined,
      rawcode: this.getKeyCode(char),
      shiftKey: options.shift || false,
      ctrlKey: options.ctrl || false,
      altKey: options.alt || false,
      metaKey: options.meta || false,
      application: options.app || 'TestApp'
    };
    
    return event;
  }

  /**
   * Generate a keyup event
   */
  keyup(char, options = {}) {
    const event = this.keydown(char, options);
    event.type = 'keyup';
    return event;
  }

  /**
   * Generate a complete keystroke (keydown + keyup)
   */
  keystroke(char, options = {}) {
    return [
      this.keydown(char, options),
      this.keyup(char, options)
    ];
  }

  /**
   * Generate a sequence of keystrokes to type text
   */
  typeText(text, options = {}) {
    const events = [];
    
    for (const char of text) {
      if (char === ' ') {
        // Space key - send both keychar and rawcode
        events.push({
          type: 'keydown',
          timestamp: this.timestamp++,
          keychar: 'Space',
          rawcode: 57,
          application: options.app || 'TestApp'
        });
        events.push({
          type: 'keyup',
          timestamp: this.timestamp++,
          keychar: 'Space',
          rawcode: 57,
          application: options.app || 'TestApp'
        });
      } else if (char === '\n') {
        // Enter key
        events.push(this.keydown('Enter', options));
        events.push(this.keyup('Enter', options));
      } else if (char === char.toUpperCase() && char !== char.toLowerCase()) {
        // Capital letter - make sure to set both keychar and shiftKey
        const lowerChar = char.toLowerCase();
        events.push({
          type: 'keydown',
          timestamp: this.timestamp++,
          keychar: char, // Send uppercase character
          rawcode: this.getKeyCode(lowerChar),
          shiftKey: true,
          application: options.app || 'TestApp'
        });
        events.push({
          type: 'keyup',
          timestamp: this.timestamp++,
          keychar: char,
          rawcode: this.getKeyCode(lowerChar),
          shiftKey: true,
          application: options.app || 'TestApp'
        });
      } else {
        // Regular character
        events.push(...this.keystroke(char, options));
      }
      
      // Add small delay between keystrokes
      if (options.delay) {
        this.timestamp += options.delay;
      }
    }
    
    return events;
  }

  /**
   * Generate a mouse click event
   */
  click(x, y, options = {}) {
    return {
      type: 'click',
      timestamp: this.timestamp++,
      x: x,
      y: y,
      button: options.button || 1,
      application: options.app || 'TestApp'
    };
  }

  /**
   * Generate a mouse down event
   */
  mousedown(x, y, options = {}) {
    const event = this.click(x, y, options);
    event.type = 'mousedown';
    return event;
  }

  /**
   * Generate a mouse up event
   */
  mouseup(x, y, options = {}) {
    const event = this.click(x, y, options);
    event.type = 'mouseup';
    return event;
  }

  /**
   * Generate Enter key press
   */
  enter() {
    return [
      {
        type: 'keydown',
        timestamp: this.timestamp++,
        keychar: undefined,
        rawcode: 28, // uiohook code for Enter
        application: 'TestApp'
      },
      {
        type: 'keyup',
        timestamp: this.timestamp++,
        keychar: undefined,
        rawcode: 28,
        application: 'TestApp'
      }
    ];
  }

  /**
   * Generate Escape key press
   */
  escape() {
    return [
      {
        type: 'keydown',
        timestamp: this.timestamp++,
        keychar: undefined,
        rawcode: 1, // uiohook code for Escape
        application: 'TestApp'
      },
      {
        type: 'keyup',
        timestamp: this.timestamp++,
        keychar: undefined,
        rawcode: 1,
        application: 'TestApp'
      }
    ];
  }

  /**
   * Generate Backspace key press
   */
  backspace() {
    return [
      {
        type: 'keydown',
        timestamp: this.timestamp++,
        keychar: undefined,
        rawcode: 14, // uiohook code for Backspace
        application: 'TestApp'
      },
      {
        type: 'keyup',
        timestamp: this.timestamp++,
        keychar: undefined,
        rawcode: 14,
        application: 'TestApp'
      }
    ];
  }

  /**
   * Get uiohook key code for a character
   */
  getKeyCode(char) {
    // Map characters to uiohook raw codes
    // Using non-conflicting codes for testing
    const keyMap = {
      'a': 4, 'b': 5, 'c': 6, 'd': 7, 'e': 8, 'f': 9, 'g': 10, 'h': 11,
      'i': 12, 'j': 13, 'k': 37, 'l': 15, 'm': 16, 'n': 17, 'o': 18, 'p': 19,
      'q': 20, 'r': 21, 's': 22, 't': 23, 'u': 24, 'v': 25, 'w': 26, 'x': 27,
      'y': 44, 'z': 29,
      '1': 30, '2': 31, '3': 32, '4': 33, '5': 34, 
      '6': 35, '7': 36, '8': 38, '9': 39, '0': 40,
      'Space': 57,
      'Enter': 28,
      'Escape': 1,
      'Backspace': 14,
      'Tab': 15
    };
    
    const lowerChar = typeof char === 'string' ? char.toLowerCase() : char;
    return keyMap[lowerChar] || 0;
  }

  /**
   * Generate a complete typing scenario
   */
  typingScenario(text, appName = 'Notion') {
    const events = [];
    
    // Click to focus
    events.push(this.click(500, 300, { app: appName }));
    
    // Type the text
    events.push(...this.typeText(text, { app: appName, delay: 50 }));
    
    return events;
  }

  /**
   * Generate a complex action sequence
   */
  complexScenario() {
    const events = [];
    
    // Click in Notion
    events.push(this.click(400, 200, { app: 'Notion' }));
    
    // Type some text
    events.push(...this.typeText('Hello World', { app: 'Notion' }));
    
    // Press Enter
    events.push(...this.enter());
    
    // Type more text
    events.push(...this.typeText('This is a test', { app: 'Notion' }));
    
    // Click somewhere else
    events.push(this.click(600, 400, { app: 'Notion' }));
    
    return events;
  }
}

module.exports = EventGenerator;