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
            copy: /^(ctrl|cmd)\+c$/i,
            paste: /^(ctrl|cmd)\+v$/i,
            save: /^(ctrl|cmd)\+s$/i,
            search: /^(ctrl|cmd)\+f$/i,
            selectAll: /^(ctrl|cmd)\+a$/i,
            undo: /^(ctrl|cmd)\+z$/i,
            redo: /^(ctrl|cmd)\+(y|shift\+z)$/i,
            cut: /^(ctrl|cmd)\+x$/i,
            switchApp: /^(alt|cmd)\+tab$/i,
            markImportant: /^(ctrl|cmd)\+shift\+m$/i
        };
        
        // Background enrichment queue for async selector capture
        this.enrichmentQueue = [];
        this.enrichmentWorker = null;
        this.enrichmentRunning = false;
        
        // Pre-emptive element cache for hover tracking
        this.hoveredElement = null;
        this.lastHoverX = null;
        this.lastHoverY = null;
        this.hoverCacheTimeout = null;
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
     * Add input value event from browser monitoring
     * This provides accurate text capture when keystroke mapping fails
     */
    addInputValueEvent(data) {
        if (!data) return;
        
        const event = {
            type: 'input_value',
            subType: data.type, // 'typed', 'changed', or 'final'
            text: data.value,
            timestamp: data.timestamp || Date.now(),
            element: {
                type: data.elementType,
                name: data.elementName,
                id: data.elementId,
                selector: data.selector
            },
            source: 'browser_monitoring',
            description: `Input value in ${data.elementName || data.elementId || 'field'}: "${data.value}"`
        };
        
        console.log('[CaptureService] Adding input value event:', event.description);
        
        // Add to global buffer
        this.globalEventBuffer.push(event);
        
        // Trim buffer if too large
        if (this.globalEventBuffer.length > this.maxBufferSize) {
            this.globalEventBuffer.shift();
        }
        
        // Emit for UI update
        this.emit('activity', event);
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
        
        // Mouse move events for pre-emptive hover tracking
        let lastMoveTime = 0;
        this.ioHook.on('mousemove', async (event) => {
            if (!this.isCapturing) return;
            
            // Throttle to max 5 times per second to prevent overwhelming
            const now = Date.now();
            if (now - lastMoveTime < 200) return;
            lastMoveTime = now;
            
            // Track hover position for pre-emptive element capture
            this.trackMouseHover(event.x, event.y);
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
        
        // Get the base key
        let key = this.getKeyName(event);
        
        // Build key combination with modifiers (Cmd+V, Ctrl+C, etc.)
        if ((event.metaKey || event.ctrlKey) && key !== 'Cmd' && key !== 'Ctrl') {
            // Use Cmd for macOS, Ctrl for Windows/Linux
            const modifier = event.metaKey ? 'Cmd' : 'Ctrl';
            key = `${modifier}+${key}`;
            console.log(`🔑 Key combination detected: ${key}`);
        } else if (event.altKey && key !== 'Alt') {
            key = `Alt+${key}`;
        } else if (event.shiftKey && key !== 'Shift' && key.length === 1) {
            // Only add Shift+ for non-letter keys (letters are already uppercase)
            if (!/[A-Z]/.test(key)) {
                key = `Shift+${key}`;
            }
        }
        
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
        
        // Handle unmapped keys (KeyXX format) - try to extract from keychar if available
        if (key.startsWith('Key') && event.keychar) {
            const possibleChar = String.fromCharCode(event.keychar);
            if (possibleChar && possibleChar.match(/[\x20-\x7E]/)) {
                key = possibleChar;
                console.log(`[CaptureService] Recovered character '${key}' from keychar for unmapped keycode ${event.keycode}`);
            }
        }
        
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
        
        // PHASE 1: Check pre-emptive cache first (instant)
        if (this.hoveredElement && 
            this.lastHoverX === event.x && 
            this.lastHoverY === event.y) {
            // Use cached element from hover
            activity.element = this.hoveredElement.element;
            activity.pageContext = this.hoveredElement.pageContext;
            
            // Update description with cached context
            const element = this.hoveredElement.element;
            if (element?.selectors?.text) {
                activity.description = `Clicked "${element.selectors.text}" in ${context.application}`;
            } else if (element?.tag) {
                activity.description = `Clicked <${element.tag}> element in ${context.application}`;
            }
            
            console.log('⚡ Used pre-cached element from hover:', {
                selector: element?.selectors?.css,
                cached: true
            });
        }
        
        // PHASE 2: Queue for background enrichment if it's a web app
        if (this.isBrowser(context.application, context.window)) {
            // Mark for enrichment
            activity.needsEnrichment = !activity.element; // Only if not pre-cached
            activity.enrichmentAttempts = 0;
            activity.maxEnrichmentAttempts = 3;
            
            // Add to enrichment queue for background processing
            if (activity.needsEnrichment && this.browserContextGetter) {
                this.enrichmentQueue.push({
                    activity,
                    timestamp: Date.now(),
                    x: event.x,
                    y: event.y
                });
                
                // Start enrichment worker if not running
                if (!this.enrichmentRunning) {
                    this.startEnrichmentWorker();
                }
            }
            
            // Fallback to basic browser context for immediate use
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
     * Check if application is a browser or web-based app
     */
    isBrowser(appName, windowTitle) {
        if (!appName) return false;
        
        // Traditional browsers
        const browsers = ['Chrome', 'Chromium', 'Firefox', 'Safari', 'Edge', 
                         'Opera', 'Brave', 'Arc', 'Vivaldi', 'Tor', 'DuckDuckGo'];
        
        // Electron-based apps with web content
        const electronApps = [
            'Code', 'Visual Studio Code', 'VSCode', 'VSCodium',  // VS Code variants
            'Slack', 'Discord', 'Teams', 'Microsoft Teams',      // Communication
            'Notion', 'Obsidian', 'Roam', 'Logseq',             // Note-taking
            'Figma', 'Framer', 'Sketch',                        // Design tools
            'Postman', 'Insomnia', 'Paw',                       // API tools
            'WhatsApp', 'Signal', 'Telegram',                   // Messaging
            'Spotify', 'YouTube Music',                         // Media
            'Skype', 'Zoom', 'Loom',                           // Video
            'GitHub Desktop', 'GitKraken', 'Sourcetree',        // Git
            'Atom', 'Sublime Text', 'Brackets',                 // Editors
            'Hyper', 'Terminus', 'iTerm',                       // Terminals
            'Linear', 'Asana', 'Monday', 'ClickUp',            // Project management
            'Evernote', 'OneNote', 'Bear', 'Craft'             // Notes
        ];
        
        // Business/Enterprise web apps (often in browser or Electron wrapper)
        const businessApps = [
            'Salesforce', 'HubSpot', 'Zendesk', 'ServiceNow',   // CRM/Service
            'Jira', 'Confluence', 'Trello', 'Basecamp',         // Atlassian/PM
            'Office', 'Word', 'Excel', 'PowerPoint', 'Outlook',  // Microsoft
            'Google', 'Gmail', 'Drive', 'Docs', 'Sheets',       // Google
            'Tableau', 'Power BI', 'Looker', 'DataDog',         // Analytics
            'Stripe', 'Square', 'PayPal', 'QuickBooks',         // Finance
            'Workday', 'BambooHR', 'Greenhouse', 'Lever',       // HR
            'Box', 'Dropbox', 'OneDrive',                       // Storage
            'DocuSign', 'HelloSign', 'PandaDoc',                // Documents
            'Intercom', 'Drift', 'Crisp',                       // Support
            'Airtable', 'Coda', 'Retool',                       // Low-code
            'Miro', 'Mural', 'Lucidchart',                      // Collaboration
            'AWS', 'Azure', 'Google Cloud'                      // Cloud consoles
        ];
        
        // Check app name against all lists
        const appNameLower = appName.toLowerCase();
        if (browsers.some(b => appNameLower.includes(b.toLowerCase()))) return true;
        if (electronApps.some(app => appNameLower.includes(app.toLowerCase()))) return true;
        if (businessApps.some(app => appNameLower.includes(app.toLowerCase()))) return true;
        
        // Check window title for web indicators
        if (windowTitle) {
            const titleLower = windowTitle.toLowerCase();
            
            // URLs in title
            if (windowTitle.includes('http://') || windowTitle.includes('https://')) return true;
            
            // Common web app patterns in title
            if (windowTitle.includes(' - Google') || 
                windowTitle.includes(' | ') ||
                windowTitle.includes(' · ') ||
                windowTitle.includes(' — ')) return true;
            
            // Check if any business app name appears in window title
            if (businessApps.some(app => titleLower.includes(app.toLowerCase()))) return true;
            
            // Common web framework indicators
            if (titleLower.includes('localhost:') || 
                titleLower.includes('127.0.0.1:') ||
                titleLower.includes('.com') ||
                titleLower.includes('.org') ||
                titleLower.includes('.net') ||
                titleLower.includes('.app') ||
                titleLower.includes('.io')) return true;
        }
        
        // Check if it's any Electron app (broader detection)
        // Many Electron apps have "Electron" or "Helper" in process name
        if (appName.includes('Electron') || 
            appName.includes('Helper') ||
            appName.includes('Renderer')) return true;
        
        return false;
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
        // First, try to get the actual character from keychar (most reliable for printable chars)
        if (event.keychar && event.keychar > 0) {
            const char = String.fromCharCode(event.keychar);
            // Check if it's a printable ASCII character
            if (char && char.match(/[\x20-\x7E]/)) {
                return char;
            }
        }
        
        // Try raw keycode for extended ASCII (fallback for some systems)
        if (event.rawcode && event.rawcode >= 32 && event.rawcode <= 126) {
            const char = String.fromCharCode(event.rawcode);
            if (char && char.match(/[\x20-\x7E]/)) {
                return char;
            }
        }
        
        // Special keys and modifiers mapping (only for non-printable keys)
        const specialKeyMap = {
            // Modifier keys
            29: 'Ctrl',
            56: 'Alt',
            42: 'Shift',
            54: 'Shift',  // Right shift
            91: 'Cmd',
            3675: 'Cmd',  // macOS Command key
            3676: 'Cmd',  // macOS Command key (right)
            
            // Special keys (non-printable)
            13: 'Enter',
            27: 'Escape',
            9: 'Tab',
            8: 'Backspace',
            46: 'Delete',
            32: 'Space',
            
            // Arrow keys
            57416: 'Up',
            57424: 'Down',
            57419: 'Left',
            57421: 'Right',
            
            // Function keys
            59: 'F1',
            60: 'F2',
            61: 'F3',
            62: 'F4',
            63: 'F5',
            64: 'F6',
            65: 'F7',
            66: 'F8',
            67: 'F9',
            68: 'F10',
            87: 'F11',
            88: 'F12',
            
            // Navigation keys
            36: 'Home',
            35: 'End',
            33: 'PageUp',
            34: 'PageDown',
            45: 'Insert',
            
            // Numpad keys (when num lock is off)
            96: 'Numpad0',
            97: 'Numpad1',
            98: 'Numpad2',
            99: 'Numpad3',
            100: 'Numpad4',
            101: 'Numpad5',
            102: 'Numpad6',
            103: 'Numpad7',
            104: 'Numpad8',
            105: 'Numpad9'
        };
        
        // Check if it's a known special key
        if (specialKeyMap[event.keycode]) {
            return specialKeyMap[event.keycode];
        }
        
        // Platform-specific special keys
        if (process.platform === 'darwin') {
            // macOS-specific special keys (not letters/numbers)
            const macSpecialKeys = {
                36: 'Return',  // macOS Return key
                48: 'Tab',     // macOS Tab
                51: 'Delete',  // macOS Delete
                53: 'Escape',  // macOS Escape
                // Arrow keys on macOS
                123: 'Left',
                124: 'Right',
                125: 'Down',
                126: 'Up'
            };
            
            if (macSpecialKeys[event.keycode]) {
                return macSpecialKeys[event.keycode];
            }
        }
        
        // Standard keyboard letter mapping (A-Z)
        // Note: Keycodes can vary by system/platform
        const letterKeyMap = {
            // Common Windows/Linux scancodes
            16: 'q', 17: 'w', 18: 'e', 19: 'r', 20: 't', 
            21: 'y', 22: 'u', 23: 'i', 24: 'o', 25: 'p',
            30: 'a', 31: 's', 32: 'd', 33: 'f', 34: 'g',
            35: 'h', 36: 'j', 37: 'k', 38: 'l',
            44: 'z', 45: 'x', 46: 'c', 47: 'v', 48: 'b',
            49: 'n', 50: 'm',
            
            // Number row
            2: '1', 3: '2', 4: '3', 5: '4', 6: '5',
            7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
            
            // Common punctuation
            12: '-', 13: '=', 26: '[', 27: ']', 39: ';',
            40: "'", 41: '`', 43: '\\', 51: ',', 52: '.', 53: '/',
            
            // Additional mappings for 'y' 
            14: 'y'
        };
        
        // Alternative mappings for different systems
        // Based on the issue: Key50='S', Key19='u', Key21='e', Key31='l', Key14='y', Key20='k', Key23='y'
        const alternativeKeyMap = {
            50: 's',  // Reported as 'S' in the issue
            19: 'u',  // Matches standard mapping
            21: 'e',  // Note: conflicts with 'y' in standard
            31: 'l',  // Conflicts with 's' in standard
            20: 'k',  // Conflicts with 't' in standard
            23: 'y'   // Conflicts with 'i' in standard
        };
        
        // Try alternative mapping first if it exists (seems to be the user's system)
        if (alternativeKeyMap[event.keycode]) {
            const char = alternativeKeyMap[event.keycode];
            if (event.shiftKey && char.match(/[a-z]/)) {
                return char.toUpperCase();
            }
            return char;
        };
        
        // Check letter/number mapping
        if (letterKeyMap[event.keycode]) {
            // Apply shift modifier for uppercase if needed
            const char = letterKeyMap[event.keycode];
            if (event.shiftKey && char.match(/[a-z]/)) {
                return char.toUpperCase();
            }
            return char;
        }
        
        // If we can't determine the key, return a generic identifier
        // This should rarely happen for normal typing
        console.log(`[CaptureService] Unmapped keycode: ${event.keycode}, keychar: ${event.keychar}, rawcode: ${event.rawcode}`);
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
    /**
     * Start background enrichment worker
     */
    startEnrichmentWorker() {
        if (this.enrichmentRunning) return;
        
        this.enrichmentRunning = true;
        
        const processQueue = async () => {
            while (this.enrichmentQueue.length > 0 && this.enrichmentRunning) {
                const item = this.enrichmentQueue.shift();
                if (!item) continue;
                
                const { activity, x, y } = item;
                const age = Date.now() - item.timestamp;
                
                // Skip if too old (> 5 seconds)
                if (age > 5000) {
                    console.log('⏭️ Skipping stale enrichment task');
                    continue;
                }
                
                // Try to enrich
                if (this.browserContextGetter && activity.needsEnrichment) {
                    try {
                        const delays = [0, 50, 150]; // Retry delays
                        const delay = delays[activity.enrichmentAttempts] || 0;
                        
                        if (delay > 0) {
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        
                        const browserData = await this.browserContextGetter(x, y);
                        
                        if (browserData && browserData.element) {
                            // Update the activity in place
                            activity.element = browserData.element;
                            activity.pageContext = browserData.pageContext;
                            activity.needsEnrichment = false;
                            
                            // Update description
                            const element = browserData.element;
                            if (element.selectors?.text) {
                                activity.description = `Clicked "${element.selectors.text}" in ${activity.application}`;
                            } else if (element.tag) {
                                activity.description = `Clicked <${element.tag}> element in ${activity.application}`;
                            }
                            
                            console.log('✨ Background enrichment successful:', {
                                selector: element.selectors?.css,
                                attempt: activity.enrichmentAttempts + 1,
                                delay: delay
                            });
                            
                            // Emit update event
                            this.emit('activity:enriched', activity);
                        } else {
                            throw new Error('No element data returned');
                        }
                    } catch (error) {
                        activity.enrichmentAttempts++;
                        
                        // Re-queue if more attempts available
                        if (activity.enrichmentAttempts < activity.maxEnrichmentAttempts) {
                            this.enrichmentQueue.push({ activity, timestamp: item.timestamp, x, y });
                            console.log(`🔄 Re-queuing for enrichment attempt ${activity.enrichmentAttempts + 1}`);
                        } else {
                            console.log('❌ Enrichment failed after all attempts');
                            activity.needsEnrichment = false; // Give up
                        }
                    }
                }
                
                // Small delay between items to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            this.enrichmentRunning = false;
        };
        
        // Start processing in background
        processQueue().catch(error => {
            console.error('Enrichment worker error:', error);
            this.enrichmentRunning = false;
        });
    }
    
    /**
     * Track mouse hover for pre-emptive element capture
     */
    async trackMouseHover(x, y) {
        // Only track if in a browser/web app
        const context = await this.getContext();
        if (!this.isBrowser(context.application, context.window)) {
            return;
        }
        
        // Clear previous cache timeout
        if (this.hoverCacheTimeout) {
            clearTimeout(this.hoverCacheTimeout);
        }
        
        // Don't fetch if same position
        if (this.lastHoverX === x && this.lastHoverY === y) {
            return;
        }
        
        this.lastHoverX = x;
        this.lastHoverY = y;
        
        // Fetch element in background (non-blocking)
        if (this.browserContextGetter) {
            this.browserContextGetter(x, y)
                .then(browserData => {
                    if (browserData && browserData.element) {
                        this.hoveredElement = browserData;
                        console.log('🎯 Pre-cached element on hover:', {
                            selector: browserData.element.selectors?.css,
                            x, y
                        });
                        
                        // Clear cache after 2 seconds
                        this.hoverCacheTimeout = setTimeout(() => {
                            this.hoveredElement = null;
                            this.lastHoverX = null;
                            this.lastHoverY = null;
                        }, 2000);
                    }
                })
                .catch(error => {
                    // Silent fail - this is just optimization
                });
        }
    }
    
    async cleanup() {
        // Stop enrichment worker
        this.enrichmentRunning = false;
        this.enrichmentQueue = [];
        
        // Clear hover cache
        if (this.hoverCacheTimeout) {
            clearTimeout(this.hoverCacheTimeout);
        }
        
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