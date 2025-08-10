/**
 * Capture Service - System-wide event capture
 * Integrates with uiohook-napi for global keystroke and mouse capture
 * Compatible with modern Electron versions (27+)
 */

const EventEmitter = require('events');
const activeWin = require('active-win');
// Temporarily disable browser context to avoid async issues
// const BrowserContextService = require('./browser-context-service');

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
        // this.browserContext = new BrowserContextService(); // Browser context capture - DISABLED for stability
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
            
            // Browser context temporarily disabled to avoid Electron async issues
            // TODO: Move browser context to a separate process or use IPC
            /*
            setTimeout(async () => {
                try {
                    const connected = await this.browserContext.connectToExistingBrowser();
                    if (connected) {
                        console.log('Connected to browser for enhanced context capture');
                        await this.browserContext.monitorPages();
                    } else {
                        console.log('No browser connection - basic capture only');
                    }
                } catch (error) {
                    console.warn('Browser context service initialization failed:', error);
                }
            }, 1000);
            */
            
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
                this.emit('activity', {
                    type: 'mark_important',
                    timestamp: Date.now(),
                    context: context,
                    application: context.application,
                    window: context.window,
                    description: `Mark important step in ${context.application}`
                });
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
     * Create keystroke activity object
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
        
        const activity = {
            type: 'keystroke',
            key: key,
            keycode: event.keycode,
            isImportant: isImportant,
            timestamp: Date.now(),
            context: context,
            application: context.application,
            window: context.window,
            description: `Pressed ${key} in ${context.application}`
        };
        
        // Detect patterns
        if (isImportant) {
            activity.pattern = this.detectPattern(key);
        }
        
        // console.log('Keystroke activity created:', activity); // Commented to prevent EPIPE
        
        return activity;
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
            // Try to get element context from browser using Playwright
            if (this.browserContext && this.browserContext.isConnected && this.browserContext.activePage) {
                try {
                    // Get element at click position
                    const element = await this.browserContext.getElementAtPoint(event.x, event.y);
                    if (element) {
                        activity.element = element;
                        
                        // Get page context
                        const pageContext = await this.browserContext.getPageContext();
                        if (pageContext) {
                            activity.pageContext = pageContext;
                        }
                        
                        // Update description with rich context
                        if (element.selectors?.text) {
                            activity.description = `Clicked "${element.selectors.text}" in ${context.application}`;
                        } else if (element.tag) {
                            activity.description = `Clicked <${element.tag}> element in ${context.application}`;
                        }
                        
                        // Add URL to description if available
                        if (pageContext?.url) {
                            activity.description += ` - ${pageContext.url}`;
                        }
                    }
                } catch (error) {
                    this.safeLog('Failed to get browser element context:', error.message);
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
        const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Brave'];
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
     * Get human-readable key name
     */
    getKeyName(event) {
        // Map common keycodes to names
        const keyMap = {
            29: 'Ctrl',
            56: 'Alt',
            42: 'Shift',
            91: 'Cmd',
            3675: 'Cmd',  // macOS Command key
            3676: 'Cmd',  // macOS Command key (right)
            50: 'M',      // M key
            5: 'E',       // E key
            13: 'Enter',
            27: 'Escape',
            9: 'Tab',
            8: 'Backspace',
            46: 'Delete',
            32: 'Space',
            37: 'Left',
            38: 'Up',
            39: 'Right',
            40: 'Down'
        };
        
        if (keyMap[event.keycode]) {
            return keyMap[event.keycode];
        }
        
        // Try to get character
        if (event.keychar) {
            return String.fromCharCode(event.keychar);
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
        // Clean up browser context
        if (this.browserContext) {
            try {
                await this.browserContext.disconnect();
            } catch (error) {
                console.error('Error cleaning up browser context:', error);
            }
        }
        
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