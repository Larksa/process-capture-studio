/**
 * Capture Service - System-wide event capture
 * Integrates with uiohook-napi for global keystroke and mouse capture
 * Compatible with modern Electron versions (27+)
 */

const EventEmitter = require('events');
const activeWin = require('active-win');

class CaptureService extends EventEmitter {
    constructor() {
        super();
        this.isCapturing = false;
        this.ioHook = null;
        this.activityBuffer = [];
        this.lastActivity = null;
        this.keyBuffer = [];
        this.debugMode = process.env.DEBUG_CAPTURE === 'true';
        this.mainWindowBounds = null; // Track main window position
        this.captureInternalClicks = false; // Filter internal clicks by default
        this.isMarkingStep = false; // Flag to prevent recording during mark action
        this.browserContextGetter = null; // Function to get browser context from worker
        
        // Global event buffer - source of truth for ALL captured data
        this.globalEventBuffer = [];
        this.maxBufferSize = 10000; // Keep last 10k events
        
        // Keystroke buffering for text reconstruction
        this.keystrokeBuffer = [];
        this.keystrokeTimeout = null;
        this.lastKeystrokeTime = 0;
        this.pythonBridge = null; // Reference to Python bridge for Excel context
        
        this.importantPatterns = {
            copy: /ctrl\+c|cmd\+c/i,
            paste: /ctrl\+v|cmd\+v/i,
            save: /ctrl\+s|cmd\+s/i,
            search: /ctrl\+f|cmd\+f/i,
            selectAll: /ctrl\+a|cmd\+a/i,
            undo: /ctrl\+z|cmd\+z/i,
            switchApp: /alt\+tab|cmd\+tab/i,
            markImportant: /ctrl\+shift\+m|cmd\+shift\+m/i
        };
    }

    /**
     * Store event in global buffer - source of truth
     */
    storeInGlobalBuffer(event) {
        // Add timestamp if not present
        if (!event.timestamp) {
            event.timestamp = Date.now();
        }
        
        // Log browser context if present
        if (event.element?.selectors) {
            console.log('📌 Storing enriched event in global buffer:', {
                type: event.type,
                selector: event.element.selectors.css,
                xpath: event.element.selectors.xpath,
                text: event.element.selectors.text?.substring(0, 30)
            });
        }
        
        // Add to buffer
        this.globalEventBuffer.push(event);
        
        // Trim buffer if too large
        if (this.globalEventBuffer.length > this.maxBufferSize) {
            this.globalEventBuffer.shift();
        }
    }
    
    /**
     * Get global event buffer
     */
    getGlobalEventBuffer() {
        return [...this.globalEventBuffer]; // Return copy
    }
    
    /**
     * Clear global event buffer
     */
    clearGlobalEventBuffer() {
        this.globalEventBuffer = [];
    }
    
    /**
     * Safe logging that won't crash with EPIPE
     */
    safeLog(...args) {
        try {
            if (this.debugMode) {
                console.log(...args);
            }
        } catch (error) {
            // Ignore EPIPE and other console errors
            if (error.code !== 'EPIPE') {
                // Only log non-EPIPE errors
                try {
                    console.error('Logging error:', error.message);
                } catch (e) {
                    // Even error logging failed, just ignore
                }
            }
        }
    }

    /**
     * Initialize the capture service
     */
    async initialize() {
        try {
            // Check platform-specific permissions
            if (process.platform === 'darwin') {
                await this.checkMacOSPermissions();
            }
            
            // Browser context is now handled via separate worker process
            console.log('Browser context will be enriched via worker process');
            
            // Try to load uiohook-napi (modern replacement for iohook)
            // Compatible with Electron 27 and modern Node.js versions
            try {
                const { uIOhook } = require('uiohook-napi');
                this.ioHook = uIOhook;
                console.log('uiohook-napi loaded successfully');
                this.setupIoHook();
            } catch (error) {
                console.warn('uiohook-napi not available - system-wide capture disabled', error);
                // Fall back to browser-only capture
                this.useFallbackCapture();
            }
        } catch (error) {
            console.error('Failed to initialize capture service:', error);
        }
    }

    /**
     * Check macOS accessibility permissions
     */
    async checkMacOSPermissions() {
        try {
            const { systemPreferences } = require('electron');
            
            // Check if we have accessibility permissions
            const accessibilityEnabled = systemPreferences.isTrustedAccessibilityClient(false);
            
            if (!accessibilityEnabled) {
                console.warn('⚠️ Accessibility permissions not granted!');
                console.warn('Please grant accessibility permissions to this app:');
                console.warn('1. Open System Settings > Privacy & Security > Accessibility');
                console.warn('2. Add this app to the list and enable it');
                console.warn('3. Restart the app after granting permissions');
                
                // Optionally prompt the user
                const { dialog } = require('electron');
                const result = await dialog.showMessageBox({
                    type: 'warning',
                    title: 'Accessibility Permissions Required',
                    message: 'Process Capture Studio needs accessibility permissions to capture system-wide keyboard and mouse events.',
                    detail: 'Please grant accessibility permissions in System Settings > Privacy & Security > Accessibility, then restart the app.',
                    buttons: ['Open System Settings', 'Continue Without'],
                    defaultId: 0
                });
                
                if (result.response === 0) {
                    // Open accessibility settings
                    systemPreferences.isTrustedAccessibilityClient(true);
                }
            } else {
                console.log('✅ Accessibility permissions granted');
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
        }
    }
    
    /**
     * Set Python bridge reference for Excel context
     */
    setPythonBridge(bridge) {
        this.pythonBridge = bridge;
        console.log('Python bridge connected to capture service');
    }

    /**
     * Setup iohook event listeners
     */
    setupIoHook() {
        if (!this.ioHook) {
            console.error('ioHook not available in setupIoHook');
            return;
        }

        console.log('Setting up uiohook event listeners...');

        // Keyboard events
        this.ioHook.on('keydown', async (event) => {
            // console.log('Global keydown detected:', event); // Commented to prevent EPIPE
            
            // Check for Cmd+Shift+M (mark important) even when not capturing
            if (event.metaKey && event.shiftKey && event.keycode === 50) {
                console.log('Cmd+Shift+M detected - marking as important!');
                // Always emit this special event
                const context = await this.getContext();
                const markEvent = {
                    type: 'mark_important',
                    timestamp: Date.now(),
                    context: context,
                    application: context.application,
                    window: context.window,
                    description: `Mark important step in ${context.application}`
                };
                this.storeInGlobalBuffer(markEvent);
                this.emit('activity', markEvent);
                return;
            }
            
            if (!this.isCapturing) return;
            
            const activity = await this.createKeystrokeActivity(event);
            if (activity) { // Only process if activity was created (not filtered)
                this.processActivity(activity);
            }
        });

        // Mouse events - try different event names
        this.ioHook.on('mouseclick', async (event) => {
            // console.log('Global mouse click detected:', event); // Commented to prevent EPIPE
            if (!this.isCapturing) {
                // console.log('Not capturing - ignoring mouse click');
                return;
            }
            
            const activity = await this.createClickActivity(event);
            if (activity) { // Only process if activity was created (not filtered)
                this.processActivity(activity);
            }
        });

        // Also try mousedown
        this.ioHook.on('mousedown', async (event) => {
            // console.log('Global mouse down detected:', event); // Commented to prevent EPIPE
            if (!this.isCapturing) {
                // console.log('Not capturing - ignoring mouse down');
                return;
            }
            
            const activity = await this.createClickActivity(event);
            if (activity) { // Only process if activity was created (not filtered)
                this.processActivity(activity);
            }
        });

        // And mouseup  
        this.ioHook.on('mouseup', async (event) => {
            // console.log('Global mouse up detected:', event); // Commented to prevent EPIPE
            // Just log for debugging
        });

        // Mouse wheel events (for scroll tracking)
        this.ioHook.on('mousewheel', async (event) => {
            if (!this.isCapturing) return;
            
            // Only capture significant scrolls
            if (Math.abs(event.rotation) > 3) {
                const activity = {
                    type: 'scroll',
                    direction: event.rotation > 0 ? 'up' : 'down',
                    timestamp: Date.now(),
                    context: await this.getContext()
                };
                
                this.processActivity(activity);
            }
        });

        // Register and start
        try {
            console.log('Starting uiohook...');
            this.ioHook.start(false); // false = don't block input
            console.log('uiohook started successfully!');
        } catch (error) {
            console.error('Failed to start uiohook:', error);
            console.error('Make sure accessibility permissions are granted');
            this.useFallbackCapture();
        }
    }

    /**
     * Fallback capture for when iohook isn't available
     */
    useFallbackCapture() {
        console.log('Using fallback capture (browser events only)');
        // The renderer process will handle browser-based capture
        // This is a degraded mode but still functional
    }

    /**
     * Create keystroke activity object with text buffering
     */
    async createKeystrokeActivity(event) {
        // Don't record if we're in the middle of marking a step
        if (this.isMarkingStep) {
            this.safeLog('Ignoring keystroke during mark step action');
            return null;
        }
        
        const key = this.getKeyName(event);
        const isImportant = this.isImportantKeystroke(key);
        const context = await this.getContext();
        
        // Filter out keystrokes in Process Capture Studio itself
        if (!this.captureInternalClicks) {
            // Only filter if window title explicitly mentions our app
            // Don't filter by "Electron" since that matches VS Code, Slack, etc.
            if (context.window?.includes('Process Capture Studio')) {
                this.safeLog('Ignoring keystroke in Process Capture Studio');
                return null; // Don't create activity for internal keystrokes
            }
        }
        
        // Build key buffer for combo detection
        this.keyBuffer.push(key);
        if (this.keyBuffer.length > 10) {
            this.keyBuffer.shift();
        }
        
        // Buffer regular characters for text reconstruction
        const now = Date.now();
        const timeSinceLastKey = now - this.lastKeystrokeTime;
        
        // If it's a regular character typed quickly, buffer it
        if (!isImportant && key.length === 1 && key.match(/[A-Za-z0-9 .,!?@#$%^&*()_\-+=]/) && timeSinceLastKey < 1000) {
            this.keystrokeBuffer.push(key);
            this.lastKeystrokeTime = now;
            
            // Clear existing timeout
            if (this.keystrokeTimeout) {
                clearTimeout(this.keystrokeTimeout);
            }
            
            // Set new timeout to emit buffered text after 500ms of no typing
            this.keystrokeTimeout = setTimeout(() => {
                this.emitBufferedKeystrokes(context);
            }, 500);
            
            // Don't emit individual characters
            return null;
        } else if (isImportant || timeSinceLastKey > 1000 || key === 'Enter') {
            // Emit any buffered keystrokes first
            if (this.keystrokeBuffer.length > 0) {
                this.emitBufferedKeystrokes(context);
            }
        }
        
        this.lastKeystrokeTime = now;
        
        const activity = {
            type: 'keystroke',
            key: key,
            keycode: event.keycode,
            isImportant: isImportant,
            timestamp: now,
            context: context,
            application: context.application,
            window: context.window,
            description: `Pressed ${key} in ${context.application}`
        };
        
        // Detect patterns
        if (isImportant) {
            activity.pattern = this.detectPattern(key);
            
            // Universal paste pattern handling for all applications
            if (activity.pattern === 'paste') {
                console.log(`📋 Paste detected in ${context.application} - requesting destination context`);
                
                // Request destination context from Python service
                if (this.pythonBridge && this.pythonBridge.sendToPython) {
                    this.pythonBridge.sendToPython({
                        type: 'capture_paste_destination',
                        timestamp: activity.timestamp,
                        application: context.application,
                        window: context.window
                    });
                    
                    // Mark that we're waiting for destination context
                    activity.waitingForDestination = true;
                }
            }
        }
        
        // console.log('Keystroke activity created:', activity); // Commented to prevent EPIPE
        
        return activity;
    }
    
    /**
     * Emit buffered keystrokes as typed text
     */
    emitBufferedKeystrokes(context) {
        if (this.keystrokeBuffer.length === 0) return;
        
        const text = this.keystrokeBuffer.join('');
        this.keystrokeBuffer = [];
        
        if (this.keystrokeTimeout) {
            clearTimeout(this.keystrokeTimeout);
            this.keystrokeTimeout = null;
        }
        
        const activity = {
            type: 'typed_text',
            text: text,
            length: text.length,
            timestamp: Date.now(),
            context: context || this.lastActivity?.context,
            application: context?.application || this.lastActivity?.context?.application,
            window: context?.window || this.lastActivity?.context?.window,
            description: `Typed "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" in ${context?.application || 'Unknown'}`
        };
        
        this.processActivity(activity);
    }

    /**
     * Create click activity object
     */
    async createClickActivity(event) {
        // Don't record if we're in the middle of marking a step
        if (this.isMarkingStep) {
            console.log('Ignoring click during mark step action - flag is true');
            return null;
        }
        
        const context = await this.getContext();
        
        // Filter out clicks on Process Capture Studio itself
        if (!this.captureInternalClicks) {
            // Primary check: Use window bounds if available
            if (this.mainWindowBounds) {
                const { x, y, width, height } = this.mainWindowBounds;
                if (event.x >= x && event.x <= x + width &&
                    event.y >= y && event.y <= y + height) {
                    this.safeLog('Ignoring click within app window bounds');
                    return null;
                }
            }
            
            // Secondary check: Only filter by app name if it's explicitly our app
            // Don't filter by "Electron" since that matches VS Code, Slack, etc.
            if (context.window?.includes('Process Capture Studio')) {
                this.safeLog('Ignoring click on Process Capture Studio window');
                return null; // Don't create activity for internal clicks
            }
        }
        
        const activity = {
            type: 'click',
            button: event.button,
            position: {
                x: event.x,
                y: event.y
            },
            timestamp: Date.now(),
            context: context,
            application: context.application,
            window: context.window,
            description: `Clicked in ${context.application}`
        };
        
        // Try to get enhanced browser context if it's a browser
        if (this.isBrowser(context.application)) {
            // Try to get element context from browser using worker process
            if (this.browserContextGetter) {
                try {
                    const browserData = await this.browserContextGetter(event.x, event.y);
                    
                    if (browserData && browserData.element) {
                        activity.element = browserData.element;
                        
                        if (browserData.pageContext) {
                            activity.pageContext = browserData.pageContext;
                        }
                        
                        // Update description with rich context
                        const element = browserData.element;
                        if (element.selectors?.text) {
                            activity.description = `Clicked "${element.selectors.text}" in ${context.application}`;
                        } else if (element.tag) {
                            activity.description = `Clicked <${element.tag}> element in ${context.application}`;
                        }
                        
                        // Add URL to description if available
                        if (browserData.pageContext?.url) {
                            activity.description += ` - ${browserData.pageContext.url}`;
                        }
                        
                        console.log('✅ Enhanced browser context captured:', {
                            selector: element.selectors?.css,
                            xpath: element.selectors?.xpath,
                            id: element.selectors?.id,
                            text: element.selectors?.text,
                            url: browserData.pageContext?.url,
                            hasAttributes: !!element.selectors?.attributes
                        });
                        
                        // Log full element structure for debugging
                        console.log('📊 Full element structure:', JSON.stringify(element, null, 2));
                    }
                } catch (error) {
                    this.safeLog('Failed to get browser element context from worker:', error.message);
                }
            }
            
            // Fallback to basic browser context
            if (!activity.element) {
                activity.browserContext = await this.getBrowserContext(context);
                if (activity.browserContext?.url) {
                    activity.description = `Clicked in ${context.application} - ${activity.browserContext.url}`;
                }
            }
        }
        
        // console.log('Click activity created:', activity); // Commented to prevent EPIPE
        
        return activity;
    }

    /**
     * Get current application context
     */
    async getContext() {
        try {
            const window = await activeWin();
            
            return {
                application: window?.owner?.name || 'Unknown',
                window: window?.title || 'Unknown',
                platform: process.platform,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                application: 'Unknown',
                window: 'Unknown',
                platform: process.platform,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Check if application is a browser
     */
    isBrowser(appName) {
        if (!appName) return false;
        const browsers = ['Chrome', 'Chromium', 'Firefox', 'Safari', 'Edge', 
                         'Opera', 'Brave', 'Arc', 'Vivaldi', 'Tor', 'DuckDuckGo'];
        return browsers.some(browser => appName.includes(browser));
    }

    /**
     * Get enhanced browser context
     */
    async getBrowserContext(context) {
        try {
            // For now, return basic info from window title
            // Later we can enhance with CDP or browser extensions
            const title = context.window || '';
            
            // Try to extract URL from window title if present
            // Many browsers show "Page Title - Domain" or similar
            let url = null;
            let pageTitle = title;
            
            // Common patterns in browser window titles
            if (title.includes(' - ')) {
                const parts = title.split(' - ');
                pageTitle = parts[0];
                // Last part often contains domain
                const possibleDomain = parts[parts.length - 1];
                if (possibleDomain.includes('.')) {
                    url = possibleDomain;
                }
            }
            
            return {
                url: url,
                pageTitle: pageTitle,
                fullTitle: title
            };
        } catch (error) {
            this.safeLog('Error getting browser context:', error);
            return null;
        }
    }

    /**
     * Update main window bounds for filtering
     */
    setMainWindowBounds(bounds) {
        this.mainWindowBounds = bounds;
        this.safeLog('Updated main window bounds:', bounds);
    }

    /**
     * Set browser context getter function
     */
    setBrowserContextGetter(getter) {
        this.browserContextGetter = getter;
        console.log('Browser context getter configured');
    }

    /**
     * Set whether to capture internal clicks
     */
    setCaptureInternalClicks(enabled) {
        this.captureInternalClicks = enabled;
        this.safeLog('Capture internal clicks:', enabled);
    }

    /**
     * Get active application details
     */
    async getActiveApplication() {
        try {
            const window = await activeWin();
            
            return {
                name: window?.owner?.name,
                path: window?.owner?.path,
                title: window?.title,
                id: window?.id,
                bounds: window?.bounds
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Process captured activity
     */
    processActivity(activity) {
        // Add to buffer
        this.activityBuffer.push(activity);
        
        // Limit buffer size
        if (this.activityBuffer.length > 1000) {
            this.activityBuffer.shift();
        }
        
        // Check for important patterns
        if (this.shouldEmit(activity)) {
            this.storeInGlobalBuffer(activity);
            this.emit('activity', activity);
        }
        
        // Store last activity
        this.lastActivity = activity;
    }

    /**
     * Should emit this activity to renderer
     */
    shouldEmit(activity) {
        // Always emit important keystrokes
        if (activity.type === 'keystroke' && activity.isImportant) {
            return true;
        }
        
        // Always emit clicks
        if (activity.type === 'click') {
            return true;
        }
        
        // Emit app switches
        if (activity.context?.application !== this.lastActivity?.context?.application) {
            return true;
        }
        
        // Rate limit other events
        const timeSinceLastEmit = Date.now() - (this.lastEmitTime || 0);
        if (timeSinceLastEmit > 100) { // Max 10 events per second
            this.lastEmitTime = Date.now();
            return true;
        }
        
        return false;
    }

    /**
     * Check if keystroke is important
     */
    isImportantKeystroke(key) {
        for (const [action, pattern] of Object.entries(this.importantPatterns)) {
            if (pattern.test(key)) {
                return true;
            }
        }
        
        // Also check for function keys, enter, escape, tab
        if (/^F\d+$/.test(key) || ['Enter', 'Escape', 'Tab'].includes(key)) {
            return true;
        }
        
        return false;
    }

    /**
     * Detect keystroke pattern
     */
    detectPattern(key) {
        for (const [action, pattern] of Object.entries(this.importantPatterns)) {
            if (pattern.test(key)) {
                return action;
            }
        }
        return null;
    }

    /**
     * Get human-readable key name with improved character mapping
     */
    getKeyName(event) {
        // Extended keycode to character mapping
        const keyMap = {
            // Modifier keys
            29: 'Ctrl',
            56: 'Alt',
            42: 'Shift',
            91: 'Cmd',
            3675: 'Cmd',  // macOS Command key
            3676: 'Cmd',  // macOS Command key (right)
            
            // Special keys
            13: 'Enter',
            27: 'Escape',
            9: 'Tab',
            8: 'Backspace',
            46: 'Delete',
            32: 'Space',
            37: 'Left',
            38: 'Up',
            39: 'Right',
            40: 'Down',
            
            // Common letter mappings
            50: 'M',
            14: 'E',
            47: '.',
            44: '/',
            43: ',',
            28: '8'
        };
        
        // Platform-specific key mapping
        if (process.platform === 'darwin') {
            // macOS specific additions
            Object.assign(keyMap, {
                18: '1', 19: '2', 20: '3', 21: '4', 22: '5',
                23: '6', 24: '7', 25: '8', 26: '9', 29: '0',
                0: 'A', 11: 'B', 8: 'C', 2: 'D', 14: 'E',
                3: 'F', 5: 'G', 4: 'H', 34: 'I', 38: 'J',
                40: 'K', 37: 'L', 46: 'M', 45: 'N', 31: 'O',
                35: 'P', 12: 'Q', 15: 'R', 1: 'S', 17: 'T',
                32: 'U', 9: 'V', 13: 'W', 7: 'X', 16: 'Y',
                6: 'Z'
            });
        }
        
        if (keyMap[event.keycode]) {
            return keyMap[event.keycode];
        }
        
        // Try to get character from keychar
        if (event.keychar && event.keychar > 0) {
            const char = String.fromCharCode(event.keychar);
            if (char && char.match(/[\x20-\x7E]/)) { // Printable ASCII
                return char;
            }
        }
        
        // Try raw keycode for extended ASCII
        if (event.rawcode && event.rawcode >= 32 && event.rawcode <= 126) {
            return String.fromCharCode(event.rawcode);
        }
        
        return `Key${event.keycode}`;
    }

    /**
     * Start capturing
     */
    startCapture() {
        this.isCapturing = true;
        this.emit('capture:started');
        console.log('Capture started');
    }

    /**
     * Stop capturing
     */
    stopCapture() {
        this.isCapturing = false;
        this.emit('capture:stopped');
        console.log('Capture stopped');
    }

    /**
     * Mark current activity as important
     */
    markImportant(data) {
        // Set flag to prevent recording the marking action itself
        this.isMarkingStep = true;
        console.log('Setting isMarkingStep flag to true');
        
        const activity = {
            type: 'marked_important',
            timestamp: Date.now(),
            data: data,
            context: this.lastActivity?.context,
            recentActivities: this.activityBuffer.slice(-5)
        };
        
        this.storeInGlobalBuffer(activity);
        this.emit('activity', activity);
        
        // Reset flag after a longer delay to ensure all related clicks are ignored
        setTimeout(() => {
            this.isMarkingStep = false;
            console.log('Resetting isMarkingStep flag to false');
        }, 1000); // Increased to 1 second
    }

    /**
     * Get recent activities
     */
    getRecentActivities(count = 10) {
        return this.activityBuffer.slice(-count);
    }

    /**
     * Clear activity buffer
     */
    clearBuffer() {
        this.activityBuffer = [];
    }

    /**
     * Cleanup on exit
     */
    async cleanup() {
        // Browser context is now handled by worker process
        // No cleanup needed here
        
        // Clean up iohook
        if (this.ioHook) {
            try {
                this.ioHook.stop();
                this.ioHook.unload();
            } catch (error) {
                console.error('Error cleaning up iohook:', error);
            }
        }
    }

    /**
     * Export activity log
     */
    exportLog() {
        return {
            activities: this.activityBuffer,
            captureStart: this.captureStartTime,
            captureEnd: Date.now(),
            totalActivities: this.activityBuffer.length
        };
    }
}

module.exports = CaptureService;