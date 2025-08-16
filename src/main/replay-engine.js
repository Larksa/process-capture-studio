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
        if (!this.pythonBridge || !this.pythonBridge.isConnected()) {
            throw new Error('Python service not connected');
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
            
            this.pythonBridge.send(message);
            
            // Python actions don't have callbacks, so resolve after a short delay
            setTimeout(resolve, 100);
        });
    }
    
    /**
     * Execute Python-specific event (clipboard, Excel, etc.)
     */
    async executePythonEvent(event) {
        if (!this.pythonBridge || !this.pythonBridge.isConnected()) {
            throw new Error('Python service not connected');
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
     * Get human-readable event description
     */
    getEventDescription(event) {
        if (event.type === 'click') {
            if (event.context?.selector) {
                return `Click on ${event.context.selector}`;
            }
            return `Click at (${event.x}, ${event.y})`;
        } else if (event.type === 'keypress') {
            return `Type "${event.key}"`;
        } else if (event.type === 'navigation') {
            return `Navigate to ${event.context?.url}`;
        } else if (event.pythonEvent) {
            const pe = event.pythonEvent;
            if (pe.type === 'clipboard') {
                return `Copy/Paste text`;
            } else if (pe.type === 'excel') {
                return `Excel: ${pe.action}`;
            }
        }
        return event.type;
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