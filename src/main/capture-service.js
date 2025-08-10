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
        this.importantPatterns = {
            copy: /ctrl\+c|cmd\+c/i,
            paste: /ctrl\+v|cmd\+v/i,
            save: /ctrl\+s|cmd\+s/i,
            search: /ctrl\+f|cmd\+f/i,
            selectAll: /ctrl\+a|cmd\+a/i,
            undo: /ctrl\+z|cmd\+z/i,
            switchApp: /alt\+tab|cmd\+tab/i
        };
    }

    /**
     * Initialize the capture service
     */
    async initialize() {
        try {
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
     * Setup iohook event listeners
     */
    setupIoHook() {
        if (!this.ioHook) return;

        // Keyboard events
        this.ioHook.on('keydown', async (event) => {
            if (!this.isCapturing) return;
            
            const activity = await this.createKeystrokeActivity(event);
            this.processActivity(activity);
        });

        // Mouse events
        this.ioHook.on('mouseclick', async (event) => {
            if (!this.isCapturing) return;
            
            const activity = await this.createClickActivity(event);
            this.processActivity(activity);
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
        this.ioHook.start(false); // false = don't block input
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
        const key = this.getKeyName(event);
        const isImportant = this.isImportantKeystroke(key);
        
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
            context: await this.getContext()
        };
        
        // Detect patterns
        if (isImportant) {
            activity.pattern = this.detectPattern(key);
        }
        
        return activity;
    }

    /**
     * Create click activity object
     */
    async createClickActivity(event) {
        const context = await this.getContext();
        
        return {
            type: 'click',
            button: event.button,
            position: {
                x: event.x,
                y: event.y
            },
            timestamp: Date.now(),
            context: context,
            application: context.application,
            window: context.window
        };
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
        const activity = {
            type: 'marked_important',
            timestamp: Date.now(),
            data: data,
            context: this.lastActivity?.context,
            recentActivities: this.activityBuffer.slice(-5)
        };
        
        this.emit('activity', activity);
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
    cleanup() {
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