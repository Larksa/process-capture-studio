/**
 * Replay Engine - Executes captured automations for validation
 * Routes browser events to Playwright and desktop events to Python service
 */

const { ipcMain } = require('electron');
const { fork } = require('child_process');

class ReplayEngine {
    constructor(captureService, pythonBridge) {
        this.captureService = captureService;
        this.pythonBridge = pythonBridge;
        this.browserWorker = null;
        this.browserWorkerRequests = new Map();
        
        this.isReplaying = false;
        this.isPaused = false;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.replaySpeed = 1;
        this.stepThroughMode = false;
        this.waitingForNext = false;
        
        this.mainWindow = null;
        this.replayStartTime = null;
        this.events = [];
        
        this.setupIPC();
    }
    
    /**
     * Set the main window reference for IPC communication
     */
    setMainWindow(window) {
        this.mainWindow = window;
    }
    
    /**
     * Setup IPC handlers for replay control
     */
    setupIPC() {
        // Start replay
        ipcMain.handle('replay:start', async (event, options = {}) => {
            if (this.isReplaying) {
                return { success: false, error: 'Replay already in progress' };
            }
            
            try {
                const events = this.captureService.getGlobalEventBuffer();
                if (!events || events.length === 0) {
                    return { success: false, error: 'No events to replay' };
                }
                
                await this.startReplay(events, options);
                return { success: true };
            } catch (error) {
                console.error('Failed to start replay:', error);
                return { success: false, error: error.message };
            }
        });
        
        // Pause/Resume replay
        ipcMain.handle('replay:pause', () => {
            this.pauseReplay();
            return { success: true };
        });
        
        ipcMain.handle('replay:resume', () => {
            this.resumeReplay();
            return { success: true };
        });
        
        // Stop replay
        ipcMain.handle('replay:stop', () => {
            this.stopReplay();
            return { success: true };
        });
        
        // Next step (for step-through mode)
        ipcMain.handle('replay:next-step', () => {
            this.waitingForNext = false;
            return { success: true };
        });
    }
    
    /**
     * Start replaying captured events
     */
    async startReplay(events, options = {}) {
        console.log(`🎬 Starting replay of ${events.length} events`);
        
        this.events = events;
        this.isReplaying = true;
        this.isPaused = false;
        this.currentStep = 0;
        this.totalSteps = events.length;
        this.replaySpeed = options.speed || 1;
        this.stepThroughMode = options.stepThrough || false;
        this.replayStartTime = Date.now();
        
        // Ensure browser worker is ready if we have browser events
        const hasBrowserEvents = events.some(e => e.context?.url);
        if (hasBrowserEvents) {
            await this.ensureBrowserWorker();
        }
        
        // Send initial status
        this.sendStatus('started', {
            totalSteps: this.totalSteps,
            speed: this.replaySpeed,
            stepThrough: this.stepThroughMode
        });
        
        // Start replay loop
        this.replayLoop();
    }
    
    /**
     * Main replay loop
     */
    async replayLoop() {
        while (this.isReplaying && this.currentStep < this.totalSteps) {
            // Handle pause
            if (this.isPaused) {
                await this.delay(100);
                continue;
            }
            
            // Handle step-through mode
            if (this.stepThroughMode && this.waitingForNext) {
                await this.delay(100);
                continue;
            }
            
            const event = this.events[this.currentStep];
            
            try {
                // Send current action to UI
                this.sendStatus('action', {
                    step: this.currentStep + 1,
                    total: this.totalSteps,
                    event: this.sanitizeEvent(event)
                });
                
                // Execute the event
                await this.executeEvent(event);
                
                // Log success
                this.sendLog('success', `Step ${this.currentStep + 1}: ${this.getEventDescription(event)}`);
                
                // Update progress
                this.sendStatus('progress', {
                    current: this.currentStep + 1,
                    total: this.totalSteps,
                    percentage: ((this.currentStep + 1) / this.totalSteps) * 100
                });
                
                // In step-through mode, wait for user to continue
                if (this.stepThroughMode) {
                    this.waitingForNext = true;
                    this.sendStatus('waiting-for-next');
                }
                
            } catch (error) {
                console.error(`Error executing step ${this.currentStep + 1}:`, error);
                this.sendLog('error', `Step ${this.currentStep + 1} failed: ${error.message}`);
                
                // Ask user if they want to continue
                this.sendStatus('error', {
                    step: this.currentStep + 1,
                    error: error.message,
                    canContinue: true
                });
                
                // For now, stop on error
                this.stopReplay();
                return;
            }
            
            this.currentStep++;
            
            // Respect timing between events
            if (this.currentStep < this.totalSteps) {
                const nextEvent = this.events[this.currentStep];
                const delay = this.calculateDelay(event, nextEvent);
                if (delay > 0) {
                    await this.delay(delay / this.replaySpeed);
                }
            }
        }
        
        // Replay completed
        if (this.isReplaying && this.currentStep >= this.totalSteps) {
            this.sendStatus('completed', {
                totalSteps: this.totalSteps,
                duration: Date.now() - this.replayStartTime
            });
            this.sendLog('success', `✅ Replay completed successfully! Executed ${this.totalSteps} steps.`);
            this.stopReplay();
        }
    }
    
    /**
     * Execute a single event
     */
    async executeEvent(event) {
        // Route based on event type and context
        if (event.context?.url) {
            // Browser event - use browser worker
            return await this.executeBrowserEvent(event);
        } else if (event.type === 'mark-before') {
            // Mark before is just informational during replay
            this.sendLog('info', `📝 Intent: ${event.description}`);
            return;
        } else if (event.type === 'keypress' || event.type === 'click') {
            // Desktop event - use Python service
            return await this.executeDesktopEvent(event);
        } else if (event.pythonEvent) {
            // Python-specific event (clipboard, Excel, etc.)
            return await this.executePythonEvent(event);
        } else {
            // Unknown event type - log and continue
            console.log('Unknown event type, skipping:', event.type);
        }
    }
    
    /**
     * Execute browser event via Playwright
     */
    async executeBrowserEvent(event) {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            this.browserWorkerRequests.set(requestId, { resolve, reject });
            
            // Send to browser worker
            this.browserWorker.send({
                id: requestId,
                type: 'replay',
                data: {
                    event: event,
                    context: event.context
                }
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.browserWorkerRequests.has(requestId)) {
                    this.browserWorkerRequests.delete(requestId);
                    reject(new Error('Browser action timeout'));
                }
            }, 10000);
        });
    }
    
    /**
     * Execute desktop event via Python service
     */
    async executeDesktopEvent(event) {
        if (!this.pythonBridge) {
            console.warn('Python bridge not initialized, skipping desktop event');
            return Promise.resolve();
        }
        
        if (!this.pythonBridge.isConnected()) {
            console.warn('Python service not connected, skipping desktop event');
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            // Send to Python service
            const message = {
                type: 'replay',
                action: event.type,
                data: {
                    x: event.x,
                    y: event.y,
                    key: event.key,
                    keycode: event.keycode,
                    button: event.button
                }
            };
            
            // Use the correct method name
            const sent = this.pythonBridge.sendToPython(message);
            if (!sent) {
                console.warn('Failed to send message to Python service');
            }
            
            // Python actions don't have callbacks, so resolve after a short delay
            setTimeout(resolve, 100);
        });
    }
    
    /**
     * Execute Python-specific event (clipboard, Excel, etc.)
     */
    async executePythonEvent(event) {
        if (!this.pythonBridge) {
            console.warn('Python bridge not initialized, skipping Python event');
            return Promise.resolve();
        }
        
        if (!this.pythonBridge.isConnected()) {
            console.warn('Python service not connected, skipping Python event');
            return Promise.resolve();
        }
        
        const pythonData = event.pythonEvent;
        
        // For now, just log these events as they're more informational
        if (pythonData.type === 'clipboard') {
            this.sendLog('info', `📋 Clipboard: ${pythonData.content?.substring(0, 50)}...`);
        } else if (pythonData.type === 'excel') {
            this.sendLog('info', `📊 Excel: ${pythonData.action} at ${pythonData.cell}`);
        }
        
        // These are captured events, not actions to replay
        // In future, we could add actual replay capability for these
        return Promise.resolve();
    }
    
    /**
     * Ensure browser worker is running
     */
    async ensureBrowserWorker() {
        if (!this.browserWorker) {
            const path = require('path');
            this.browserWorker = fork(path.join(__dirname, 'browser-context-worker.js'));
            
            this.browserWorker.on('message', (msg) => {
                if (msg.id && this.browserWorkerRequests.has(msg.id)) {
                    const { resolve, reject } = this.browserWorkerRequests.get(msg.id);
                    this.browserWorkerRequests.delete(msg.id);
                    
                    if (msg.error) {
                        reject(new Error(msg.error));
                    } else {
                        resolve(msg.result);
                    }
                }
            });
            
            // Give worker time to initialize
            await this.delay(1000);
        }
    }
    
    /**
     * Pause replay
     */
    pauseReplay() {
        if (this.isReplaying && !this.isPaused) {
            this.isPaused = true;
            this.sendStatus('paused');
            this.sendLog('info', '⏸️ Replay paused');
        }
    }
    
    /**
     * Resume replay
     */
    resumeReplay() {
        if (this.isReplaying && this.isPaused) {
            this.isPaused = false;
            this.sendStatus('resumed');
            this.sendLog('info', '▶️ Replay resumed');
        }
    }
    
    /**
     * Stop replay
     */
    stopReplay() {
        if (this.isReplaying) {
            this.isReplaying = false;
            this.isPaused = false;
            this.currentStep = 0;
            this.waitingForNext = false;
            
            // Clean up browser worker
            if (this.browserWorker) {
                this.browserWorker.kill();
                this.browserWorker = null;
            }
            
            this.sendStatus('stopped');
            this.sendLog('info', '⏹️ Replay stopped');
        }
    }
    
    /**
     * Calculate delay between events
     */
    calculateDelay(currentEvent, nextEvent) {
        if (!currentEvent.timestamp || !nextEvent.timestamp) {
            return 500; // Default delay
        }
        
        const delay = nextEvent.timestamp - currentEvent.timestamp;
        
        // Cap delays to reasonable values
        if (delay < 0) return 0;
        if (delay > 10000) return 2000; // Cap at 2 seconds
        
        return delay;
    }
    
    /**
     * Get human-readable event description with rich context
     */
    getEventDescription(event) {
        // Handle click events with rich context
        if (event.type === 'click') {
            let description = '';
            
            // Debug: Log what we're receiving
            console.log('Click event data:', { 
                hasElement: !!event.element,
                elementText: event.element?.selectors?.text,
                elementId: event.element?.selectors?.id,
                description: event.description,
                window: event.window || event.context?.window,
                application: event.application
            });
            
            // PRIORITY 1: Use pre-captured description if available
            if (event.description && !event.description.includes('Clicked in')) {
                description = event.description;
                
                // Extract filename from window title if available
                const windowTitle = event.window || event.context?.window;
                if (windowTitle && windowTitle !== 'Unknown') {
                    const filename = this.extractFilename(windowTitle);
                    if (filename && !description.includes(filename)) {
                        description = description.replace(/ in .+$/, '') + ` in ${filename}`;
                    }
                }
                return description;
            }
            
            // PRIORITY 2: Use browser element context if available
            if (event.element?.selectors) {
                const sel = event.element.selectors;
                
                // Best: Element text (button label, link text, etc.)
                if (sel.text && sel.text.trim()) {
                    description = `Click on "${sel.text.trim()}"`;
                }
                // Good: Element ID
                else if (sel.id) {
                    description = `Click on #${sel.id}`;
                }
                // Fallback: Element tag and attributes
                else if (event.element.tag) {
                    description = `Click on <${event.element.tag}>`;
                    if (sel.attributes?.class) {
                        const mainClass = sel.attributes.class.split(' ')[0];
                        description += `.${mainClass}`;
                    }
                }
            }
            
            // PRIORITY 3: Try to extract from regular context
            if (!description && event.context) {
                const ctx = event.context;
                
                if (ctx.text && ctx.text.trim()) {
                    description = `Click on "${ctx.text.trim()}"`;
                } else if (ctx.selector) {
                    // Parse selector for meaningful info
                    if (ctx.selector.includes('#')) {
                        const id = ctx.selector.match(/#([^\s.:\[]+)/)?.[1];
                        if (id) description = `Click on #${id}`;
                    } else if (ctx.selector.includes('.')) {
                        const className = ctx.selector.match(/\.([^\s.:\[]+)/)?.[1];
                        if (className) description = `Click on element with class "${className}"`;
                    } else {
                        description = `Click on ${ctx.selector}`;
                    }
                } else if (ctx.tagName) {
                    description = `Click on <${ctx.tagName.toLowerCase()}>`;
                }
            }
            
            // LAST RESORT: Use coordinates
            if (!description) {
                const x = event.x !== undefined ? event.x : 
                          (event.position?.x !== undefined ? event.position.x : null);
                const y = event.y !== undefined ? event.y : 
                          (event.position?.y !== undefined ? event.position.y : null);
                
                if (x !== null && y !== null) {
                    description = `Click at (${x}, ${y})`;
                } else {
                    description = 'Click';
                }
            }
            
            // Add meaningful application/file context
            const windowTitle = event.window || event.context?.window;
            const appName = event.activeApp?.name || event.application || event.context?.application;
            
            if (windowTitle && windowTitle !== 'Unknown') {
                const filename = this.extractFilename(windowTitle);
                if (filename) {
                    description += ` in ${filename}`;
                } else if (appName) {
                    description += ` in ${appName}`;
                }
            } else if (appName) {
                description += ` in ${appName}`;
            }
            
            return description;
            
        } else if (event.type === 'keypress') {
            const key = event.key || event.keycode || 'unknown';
            if (event.activeApp?.name) {
                return `Type "${key}" in ${event.activeApp.name}`;
            }
            return `Type "${key}"`;
            
        } else if (event.type === 'navigation') {
            const url = event.context?.url || event.url || 'unknown URL';
            return `Navigate to ${url}`;
            
        } else if (event.pythonEvent) {
            const pe = event.pythonEvent;
            
            if (pe.type === 'clipboard') {
                const action = pe.action || 'Copy/Paste';
                const preview = pe.content ? 
                    `: "${pe.content.substring(0, 30)}${pe.content.length > 30 ? '...' : ''}"` : '';
                return `📋 ${action}${preview}`;
                
            } else if (pe.type === 'excel') {
                let desc = `📊 Excel: ${pe.action || 'Operation'}`;
                if (pe.cell) desc += ` at cell ${pe.cell}`;
                if (pe.value) desc += ` - "${pe.value}"`;
                if (pe.sheet) desc += ` in ${pe.sheet}`;
                return desc;
                
            } else if (pe.type === 'file') {
                return `📁 File: ${pe.action} "${pe.path || 'unknown'}"`;
            }
            
            return `Python: ${pe.type}`;
        }
        
        // Handle other event types
        if (event.type === 'step-boundary') {
            return `📍 Step: ${event.description || 'Step boundary'}`;
        } else if (event.type === 'mark-before') {
            return `🎯 Intent: ${event.description || 'Marked action'}`;
        }
        
        return event.type || 'Unknown action';
    }
    
    /**
     * Extract filename from window title
     */
    extractFilename(windowTitle) {
        if (!windowTitle) return null;
        
        // Common patterns for extracting filenames from window titles
        // "Document.docx - Microsoft Word" → "Document.docx"
        // "Budget-2025.xlsx - Excel" → "Budget-2025.xlsx"
        // "index.html - Process Capture Studio - Visual Studio Code" → "index.html"
        
        // Try to extract filename before first dash or pipe
        let match = windowTitle.match(/^([^—–\-|]+?)(?:\s*[—–\-|])/);
        if (match && match[1]) {
            const potential = match[1].trim();
            // Check if it looks like a filename (has extension)
            if (potential.includes('.') && !potential.startsWith('http')) {
                return potential;
            }
        }
        
        // Try to extract filename with common extensions
        match = windowTitle.match(/([^/\\]+\.\w{2,5})/);
        if (match) {
            return match[1];
        }
        
        // For Excel, Word, etc., try to get the document name
        if (windowTitle.includes('Microsoft Word') || windowTitle.includes('Word')) {
            match = windowTitle.match(/^(.+?)\s*[—–\-]/);
            if (match) return match[1].trim() + ' (Word)';
        }
        
        if (windowTitle.includes('Microsoft Excel') || windowTitle.includes('Excel')) {
            match = windowTitle.match(/^(.+?)\s*[—–\-]/);
            if (match) return match[1].trim() + ' (Excel)';
        }
        
        // For browsers, extract page title
        if (windowTitle.includes('Chrome') || windowTitle.includes('Safari') || windowTitle.includes('Firefox')) {
            match = windowTitle.match(/^(.+?)\s*[—–\-]/);
            if (match) return match[1].trim();
        }
        
        return null;
    }
    
    /**
     * Sanitize event for sending to renderer
     */
    sanitizeEvent(event) {
        // Remove sensitive data before sending to UI
        const sanitized = { ...event };
        
        // Truncate long text content
        if (sanitized.context?.text && sanitized.context.text.length > 100) {
            sanitized.context.text = sanitized.context.text.substring(0, 100) + '...';
        }
        
        if (sanitized.pythonEvent?.content && sanitized.pythonEvent.content.length > 100) {
            sanitized.pythonEvent.content = sanitized.pythonEvent.content.substring(0, 100) + '...';
        }
        
        return sanitized;
    }
    
    /**
     * Send status update to renderer
     */
    sendStatus(status, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('replay:status', { status, ...data });
        }
    }
    
    /**
     * Send log entry to renderer
     */
    sendLog(level, message) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('replay:log', { level, message, timestamp: Date.now() });
        }
    }
    
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ReplayEngine;