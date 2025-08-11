/**
 * Mark Before Handler
 * 
 * Revolutionary pattern that captures user intent BEFORE they perform actions.
 * Results in cleaner, more purposeful data capture with grouped keystrokes
 * and clear action boundaries.
 */

class MarkBeforeHandler {
  constructor() {
    this.isMarkMode = false;
    this.markStartTime = null;
    this.capturedEvents = [];
    this.currentText = '';
    this.actionDescription = '';
    this.completionCallback = null;
    this.mainWindow = null;
    this.captureTimeout = null;
    this.maxCaptureDuration = 30000; // 30 seconds max
    
    // Action type detection patterns
    this.actionPatterns = {
      typing: /^(Key|Digit|Letter)/,
      navigation: /^(Page|Arrow|Home|End)/,
      command: /^(Control|Command|Alt|Meta)/,
      submission: /^(Enter|Return)$/
    };
  }
  
  /**
   * Initialize with main window reference
   */
  init(mainWindow) {
    this.mainWindow = mainWindow;
  }
  
  /**
   * Start mark mode - ready to capture next action
   */
  startMarkMode(description = '') {
    console.log('[MarkBefore] Starting mark mode...');
    
    this.isMarkMode = true;
    this.markStartTime = Date.now();
    this.capturedEvents = [];
    this.currentText = '';
    this.actionDescription = description;
    
    // Set timeout to auto-complete after 30 seconds
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
    }
    this.captureTimeout = setTimeout(() => {
      console.log('[MarkBefore] Timeout reached, auto-completing');
      if (this.isMarkMode) {
        this.stopMarkMode('timeout-30s');
      }
    }, this.maxCaptureDuration);
    
    // Notify renderer that mark mode is active
    if (this.mainWindow) {
      this.mainWindow.webContents.send('mark:mode-started', {
        timestamp: this.markStartTime,
        description: this.actionDescription
      });
    }
    
    return true;
  }
  
  /**
   * Stop mark mode and return captured data
   */
  stopMarkMode(reason = 'manual') {
    if (!this.isMarkMode) return null;
    
    console.log(`[MarkBefore] Stopping mark mode. Reason: ${reason}, Events: ${this.capturedEvents.length}`);
    
    // Clear timeout
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = null;
    }
    
    const duration = Date.now() - this.markStartTime;
    const result = this.packageCapturedData(reason, duration);
    
    // Reset state
    this.isMarkMode = false;
    this.markStartTime = null;
    this.capturedEvents = [];
    this.currentText = '';
    this.actionDescription = '';
    
    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('mark:mode-stopped', result);
    }
    
    // Execute completion callback if set
    if (this.completionCallback) {
      this.completionCallback(result);
      this.completionCallback = null;
    }
    
    return result;
  }
  
  /**
   * Process an event while in mark mode
   */
  processEvent(event) {
    if (!this.isMarkMode) return false;
    
    console.log('[MarkBefore] Processing event:', {
      type: event.type,
      keychar: event.keychar,
      rawcode: event.rawcode,
      application: event.application,
      eventCount: this.capturedEvents.length + 1
    });
    
    // Store the event with all its data
    this.capturedEvents.push({
      ...event,
      relativeTime: Date.now() - this.markStartTime
    });
    
    // Send status update to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('mark:status-update', {
        eventCount: this.capturedEvents.length,
        currentText: this.currentText,
        duration: Date.now() - this.markStartTime
      });
    }
    
    // Handle different event types
    switch (event.type) {
      case 'keydown':
        return this.handleKeydown(event);
      case 'keyup':
        return this.handleKeyup(event);
      case 'mousedown':
      case 'click':
        return this.handleMouseEvent(event);
      case 'wheel':
        return this.handleScrollEvent(event);
      default:
        console.log('[MarkBefore] Unhandled event type:', event.type);
        return true;
    }
  }
  
  /**
   * Handle keydown events - main logic for text grouping
   */
  handleKeydown(event) {
    const key = event.keychar || '';
    const keyCode = event.keycode || event.rawcode;
    
    // Debug logging to see what keys we're getting
    console.log('[MarkBefore] Keydown event:', { 
      key, 
      keyCode, 
      keychar: event.keychar, 
      rawcode: event.rawcode,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    });
    
    // Check for Escape key
    const isEscapeKey = (
      key === 'Escape' ||
      key === 'Esc' ||
      keyCode === 27 ||
      event.rawcode === 1 // uiohook uses 1 for Escape
    );
    
    // Check for completion triggers
    if (isEscapeKey) {
      console.log('[MarkBefore] Escape detected, cancelling');
      this.stopMarkMode('cancelled');
      return true;
    }
    
    // DON'T auto-complete on Enter - let user decide when done
    // Enter during typing should just add to the text
    const isEnterKey = event.rawcode === 28;
    if (isEnterKey) {
      console.log('[MarkBefore] Enter pressed - adding newline to text');
      this.currentText += '\n';
      return true;
    }
    
    // Handle special keys first
    if (event.rawcode === 14) {
      // Backspace (rawcode 14)
      if (this.currentText.length > 0) {
        this.currentText = this.currentText.slice(0, -1);
        console.log('[MarkBefore] Backspace, Text now:', this.currentText);
      }
      return true;
    }
    
    // Build up text from printable characters
    // First check if we have a keychar (best source of truth)
    if (event.keychar && event.keychar.length === 1) {
      this.currentText += event.keychar;
      console.log('[MarkBefore] Added character from keychar:', event.keychar, 'Text so far:', this.currentText);
    } 
    // Handle space specifically (can come as 'Space' string or rawcode 57)
    else if (event.keychar === 'Space' || event.rawcode === 57) {
      this.currentText += ' ';
      console.log('[MarkBefore] Added space, Text so far:', this.currentText);
    }
    // Handle letters using our test rawcode map
    else if ((event.rawcode >= 4 && event.rawcode <= 29) || event.rawcode === 37 || event.rawcode === 44) {
      // Map rawcodes to letters for testing
      const letterMap = {
        4: 'a', 5: 'b', 6: 'c', 7: 'd', 8: 'e', 9: 'f', 10: 'g', 11: 'h',
        12: 'i', 13: 'j', 37: 'k', 15: 'l', 16: 'm', 17: 'n', 18: 'o', 19: 'p',
        20: 'q', 21: 'r', 22: 's', 23: 't', 24: 'u', 25: 'v', 26: 'w', 27: 'x',
        44: 'y', 29: 'z'
      };
      
      if (letterMap[event.rawcode]) {
        const letter = letterMap[event.rawcode];
        // Check both shiftKey and if keychar is uppercase
        const isUpperCase = event.shiftKey || 
                           (event.keychar && event.keychar === event.keychar.toUpperCase());
        const char = isUpperCase ? letter.toUpperCase() : letter;
        this.currentText += char;
        console.log('[MarkBefore] Added letter:', char, 'Text so far:', this.currentText);
      }
    }
    // Handle numbers 0-9 (rawcodes 30-40)
    else if (event.rawcode >= 30 && event.rawcode <= 40) {
      const numberMap = {
        30: '1', 31: '2', 32: '3', 33: '4', 34: '5',
        35: '6', 36: '7', 38: '8', 39: '9', 40: '0'
      };
      
      if (numberMap[event.rawcode]) {
        this.currentText += numberMap[event.rawcode];
        console.log('[MarkBefore] Added number:', numberMap[event.rawcode], 'Text so far:', this.currentText);
      }
    }
    
    // Detect command combinations (Ctrl+C, Ctrl+V, etc.)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      if (this.capturedEvents.length > 1) {
        // Command combo might end the current action
        setTimeout(() => {
          if (this.isMarkMode) {
            this.checkForCompletion('command-combo');
          }
        }, 100);
      }
    }
    
    return true;
  }
  
  /**
   * Handle keyup events
   */
  handleKeyup(event) {
    // Currently just tracking, might use for timing analysis
    return true;
  }
  
  /**
   * Handle mouse events
   */
  handleMouseEvent(event) {
    // Don't auto-complete on click - let user decide when done
    // Just record the click event
    console.log('[MarkBefore] Mouse event captured, continuing to record');
    return true;
  }
  
  /**
   * Handle scroll events
   */
  handleScrollEvent(event) {
    // Scrolling doesn't typically end a mark session
    return true;
  }
  
  /**
   * Check if we should auto-complete the mark session
   */
  checkForCompletion(reason) {
    const lastEvents = this.capturedEvents.slice(-3);
    
    // Pattern: Type then Enter = form submission
    if (this.currentText.length > 0 && 
        lastEvents.some(e => e.keychar === 'Enter' || e.keychar === 'Return')) {
      this.stopMarkMode('text-submit');
      return true;
    }
    
    // Pattern: Click after typing = field change
    if (this.currentText.length > 0 && 
        lastEvents.some(e => e.type === 'mousedown' || e.type === 'click')) {
      this.stopMarkMode('field-change');
      return true;
    }
    
    // Pattern: Tab after typing = field navigation
    if (this.currentText.length > 0 && 
        lastEvents.some(e => e.keychar === 'Tab')) {
      this.stopMarkMode('tab-navigation');
      return true;
    }
    
    return false;
  }
  
  /**
   * Package captured data into a clean format
   */
  packageCapturedData(completionReason, duration) {
    const actionType = this.determineActionType();
    
    console.log('[MarkBefore] Packaging data:', {
      actionType,
      eventCount: this.capturedEvents.length,
      currentText: this.currentText,
      completionReason,
      duration
    });
    
    const result = {
      type: 'marked-action',
      actionType: actionType,
      description: this.actionDescription,
      startTime: this.markStartTime,
      duration: duration,
      completionReason: completionReason,
      events: this.capturedEvents,
      summary: this.generateSummary(actionType)
    };
    
    // Add grouped text if we captured typing
    if (this.currentText && this.currentText.length > 0) {
      result.capturedText = this.currentText;
      // Override summary with actual text
      result.summary = `Typed: "${this.currentText}"`;
    }
    
    console.log('[MarkBefore] Final package summary:', result.summary);
    
    return result;
  }
  
  /**
   * Determine the type of action from captured events
   */
  determineActionType() {
    if (this.currentText.length > 0) {
      return 'text-input';
    }
    
    const hasClicks = this.capturedEvents.some(e => 
      e.type === 'mousedown' || e.type === 'click'
    );
    
    const hasKeys = this.capturedEvents.some(e => 
      e.type === 'keydown' || e.type === 'keyup'
    );
    
    const hasScroll = this.capturedEvents.some(e => e.type === 'wheel');
    
    if (hasClicks && !hasKeys) return 'click';
    if (hasKeys && !hasClicks) return 'keyboard';
    if (hasClicks && hasKeys) return 'mixed';
    if (hasScroll) return 'scroll';
    
    return 'unknown';
  }
  
  /**
   * Generate a human-readable summary
   */
  generateSummary(actionType) {
    // If we have typed text, that's the most important
    if (this.currentText && this.currentText.trim().length > 0) {
      const truncatedText = this.currentText.length > 50 
        ? this.currentText.substring(0, 47) + '...' 
        : this.currentText;
      return `Typed: "${truncatedText.trim()}"`;
    }
    
    // Look for application context
    const appEvent = this.capturedEvents.find(e => e.application);
    const appContext = appEvent ? ` in ${appEvent.application}` : '';
    
    switch (actionType) {
      case 'text-input':
        return `Text input${appContext}`;
      
      case 'click':
        const clickEvent = this.capturedEvents.find(e => e.type === 'click' || e.type === 'mousedown');
        if (clickEvent) {
          // Try to get more context about the click
          if (clickEvent.application) {
            return `Clicked in ${clickEvent.application}`;
          }
          return `Clicked`;
        }
        return 'Clicked';
      
      case 'keyboard':
        const keys = this.capturedEvents
          .filter(e => e.type === 'keydown')
          .map(e => e.keychar || e.rawcode)
          .filter(k => k && !this.isPrintableKey({ keychar: k }));
        if (keys.length > 0) {
          return `Keyboard shortcut: ${keys.slice(0, 3).join('+')}`;
        }
        return `Keyboard input${appContext}`;
      
      case 'mixed':
        if (this.capturedEvents.length > 20) {
          return `Complex action (${this.capturedEvents.length} events)${appContext}`;
        }
        return `Multiple actions${appContext}`;
      
      case 'scroll':
        return `Scrolled${appContext}`;
      
      default:
        // Provide more detail about what was captured
        const eventTypes = [...new Set(this.capturedEvents.map(e => e.type))];
        if (eventTypes.length > 0) {
          return `${eventTypes.join(', ')}${appContext}`;
        }
        return `Action captured${appContext}`;
    }
  }
  
  /**
   * Check if a key event represents a printable character
   */
  isPrintableKey(event) {
    const key = event.keychar || event.rawcode || '';
    
    // Single character = likely printable
    if (key.length === 1) {
      return true;
    }
    
    // Check for specific printable keys
    const printableKeys = ['Space', 'Tab'];
    return printableKeys.includes(key);
  }
  
  /**
   * Get the actual character from a key event
   */
  getCharFromEvent(event) {
    const key = event.keychar || event.rawcode || '';
    
    if (key === 'Space') return ' ';
    if (key === 'Tab') return '\t';
    if (key.length === 1) return key;
    
    // For digit keys
    if (key.startsWith('Digit')) {
      return key.replace('Digit', '');
    }
    
    // For letter keys
    if (key.startsWith('Key')) {
      const letter = key.replace('Key', '');
      return event.shiftKey ? letter.toUpperCase() : letter.toLowerCase();
    }
    
    return '';
  }
  
  /**
   * Set a callback for when mark mode completes
   */
  onCompletion(callback) {
    this.completionCallback = callback;
  }
  
  /**
   * Check if currently in mark mode
   */
  isActive() {
    return this.isMarkMode;
  }
  
  /**
   * Get current captured text (for live preview)
   */
  getCurrentText() {
    return this.currentText;
  }
  
  /**
   * Get event count (for UI display)
   */
  getEventCount() {
    return this.capturedEvents.length;
  }
}

module.exports = MarkBeforeHandler;