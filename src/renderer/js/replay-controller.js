/**
 * Replay Controller - Manages the replay UI and communicates with the replay engine
 */

class ReplayController {
    constructor() {
        this.isReplaying = false;
        this.isPaused = false;
        this.currentStep = 0;
        this.totalSteps = 0;
        
        this.elements = {};
        this.logEntries = [];
        
        this.initialize();
    }
    
    /**
     * Initialize the replay controller
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        
        console.log('🎬 Replay Controller initialized');
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Controls
            startButton: document.getElementById('replay-start'),
            pauseButton: document.getElementById('replay-pause'),
            resumeButton: document.getElementById('replay-resume'),
            stopButton: document.getElementById('replay-stop'),
            nextStepButton: document.getElementById('replay-next-step'),
            
            // Options
            speedSelect: document.getElementById('replay-speed'),
            stepThroughCheckbox: document.getElementById('step-through-mode'),
            
            // Containers
            playbackControls: document.getElementById('playback-controls'),
            
            // Progress
            progressBar: document.getElementById('replay-progress'),
            stepCounter: document.getElementById('replay-step-counter'),
            timeElapsed: document.getElementById('replay-time-elapsed'),
            
            // Display
            actionDisplay: document.getElementById('replay-action-display'),
            replayLog: document.getElementById('replay-log'),
            
            // Status
            statusText: document.getElementById('replay-status-text'),
            statsText: document.getElementById('replay-stats')
        };
    }
    
    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Start replay
        this.elements.startButton?.addEventListener('click', () => {
            this.startReplay();
        });
        
        // Pause/Resume
        this.elements.pauseButton?.addEventListener('click', () => {
            this.pauseReplay();
        });
        
        this.elements.resumeButton?.addEventListener('click', () => {
            this.resumeReplay();
        });
        
        // Stop
        this.elements.stopButton?.addEventListener('click', () => {
            this.stopReplay();
        });
        
        // Next step (for step-through mode)
        this.elements.nextStepButton?.addEventListener('click', () => {
            this.nextStep();
        });
        
        // Step-through mode toggle
        this.elements.stepThroughCheckbox?.addEventListener('change', (e) => {
            if (this.isReplaying) {
                this.addLogEntry('info', 'Step-through mode will apply on next replay');
            }
        });
    }
    
    /**
     * Setup IPC listeners for replay events
     */
    setupIPCListeners() {
        // Status updates
        window.electronAPI.onReplayStatus((data) => {
            this.handleStatusUpdate(data);
        });
        
        // Log entries
        window.electronAPI.onReplayLog((data) => {
            this.addLogEntry(data.level, data.message);
        });
    }
    
    /**
     * Start replay
     */
    async startReplay() {
        const speed = parseFloat(this.elements.speedSelect.value);
        const stepThrough = this.elements.stepThroughCheckbox.checked;
        
        console.log('Starting replay with options:', { speed, stepThrough });
        
        // Clear previous log
        this.clearLog();
        
        // Update UI state
        this.setUIState('starting');
        
        try {
            const result = await window.electronAPI.startReplay({ speed, stepThrough });
            
            if (!result.success) {
                this.addLogEntry('error', result.error || 'Failed to start replay');
                this.setUIState('ready');
            }
        } catch (error) {
            console.error('Failed to start replay:', error);
            this.addLogEntry('error', `Failed to start replay: ${error.message}`);
            this.setUIState('ready');
        }
    }
    
    /**
     * Pause replay
     */
    async pauseReplay() {
        try {
            await window.electronAPI.pauseReplay();
        } catch (error) {
            console.error('Failed to pause replay:', error);
        }
    }
    
    /**
     * Resume replay
     */
    async resumeReplay() {
        try {
            await window.electronAPI.resumeReplay();
        } catch (error) {
            console.error('Failed to resume replay:', error);
        }
    }
    
    /**
     * Stop replay
     */
    async stopReplay() {
        try {
            await window.electronAPI.stopReplay();
        } catch (error) {
            console.error('Failed to stop replay:', error);
        }
    }
    
    /**
     * Next step (for step-through mode)
     */
    async nextStep() {
        try {
            await window.electronAPI.nextReplayStep();
        } catch (error) {
            console.error('Failed to advance to next step:', error);
        }
    }
    
    /**
     * Handle status updates from the replay engine
     */
    handleStatusUpdate(data) {
        const { status } = data;
        
        switch (status) {
            case 'started':
                this.isReplaying = true;
                this.isPaused = false;
                this.totalSteps = data.totalSteps;
                this.setUIState('playing');
                this.updateStatus(`Replaying ${this.totalSteps} steps at ${data.speed}x speed`);
                break;
                
            case 'action':
                this.currentStep = data.step;
                this.displayCurrentAction(data.event);
                this.updateStepCounter(data.step, data.total);
                break;
                
            case 'progress':
                this.updateProgress(data.percentage, data.current, data.total);
                break;
                
            case 'paused':
                this.isPaused = true;
                this.setUIState('paused');
                this.updateStatus('Paused');
                break;
                
            case 'resumed':
                this.isPaused = false;
                this.setUIState('playing');
                this.updateStatus('Resumed');
                break;
                
            case 'waiting-for-next':
                this.setUIState('waiting-for-next');
                this.updateStatus('Waiting for next step...');
                break;
                
            case 'error':
                this.displayError(data);
                break;
                
            case 'completed':
                this.isReplaying = false;
                this.setUIState('ready');
                this.updateStatus(`✅ Completed ${data.totalSteps} steps in ${this.formatDuration(data.duration)}`);
                this.updateProgress(100, data.totalSteps, data.totalSteps);
                break;
                
            case 'stopped':
                this.isReplaying = false;
                this.isPaused = false;
                this.setUIState('ready');
                this.updateStatus('Stopped');
                this.resetProgress();
                break;
        }
    }
    
    /**
     * Set UI state based on replay status
     */
    setUIState(state) {
        switch (state) {
            case 'ready':
                this.elements.startButton.disabled = false;
                this.elements.startButton.textContent = '▶️ Test Replay';
                this.elements.playbackControls.style.display = 'none';
                this.elements.speedSelect.disabled = false;
                this.elements.stepThroughCheckbox.disabled = false;
                break;
                
            case 'starting':
                this.elements.startButton.disabled = true;
                this.elements.startButton.textContent = '⏳ Starting...';
                this.elements.speedSelect.disabled = true;
                this.elements.stepThroughCheckbox.disabled = true;
                break;
                
            case 'playing':
                this.elements.startButton.disabled = true;
                this.elements.startButton.textContent = '▶️ Replaying...';
                this.elements.playbackControls.style.display = 'flex';
                this.elements.pauseButton.style.display = 'inline-block';
                this.elements.resumeButton.style.display = 'none';
                this.elements.nextStepButton.style.display = 'none';
                this.elements.speedSelect.disabled = true;
                this.elements.stepThroughCheckbox.disabled = true;
                break;
                
            case 'paused':
                this.elements.pauseButton.style.display = 'none';
                this.elements.resumeButton.style.display = 'inline-block';
                break;
                
            case 'waiting-for-next':
                this.elements.pauseButton.style.display = 'none';
                this.elements.resumeButton.style.display = 'none';
                this.elements.nextStepButton.style.display = 'inline-block';
                break;
        }
    }
    
    /**
     * Display current action being executed with rich formatting
     */
    displayCurrentAction(event) {
        let actionHtml = '<div class="action-details-enhanced">';
        
        if (event.type === 'click') {
            // Main action header
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">🖱️</span>';
            
            // Build meaningful title - prioritize element context
            let title = 'Click';
            
            // Check for browser element context first
            if (event.element?.selectors) {
                const sel = event.element.selectors;
                if (sel.text && sel.text.trim()) {
                    title = `Click on "${this.escapeHtml(sel.text.trim())}"`;
                } else if (sel.id) {
                    title = `Click on #${this.escapeHtml(sel.id)}`;
                } else if (event.element.tag) {
                    title = `Click on &lt;${this.escapeHtml(event.element.tag)}&gt;`;
                }
            }
            // Fallback to regular context
            else if (event.context?.text && event.context.text.trim()) {
                title = `Click on "${this.escapeHtml(event.context.text.trim())}"`;
            } else if (event.context?.selector) {
                if (event.context.selector.includes('#')) {
                    const id = event.context.selector.match(/#([^\s.:\[]+)/)?.[1];
                    if (id) title = `Click on #${this.escapeHtml(id)}`;
                } else {
                    title = `Click on element`;
                }
            }
            // Use description if available
            else if (event.description && !event.description.includes('Clicked in')) {
                // Extract just the action part, not the "in application" part
                const actionPart = event.description.match(/^([^in]+?)(?:\s+in\s+|$)/)?.[1];
                if (actionPart) title = this.escapeHtml(actionPart.trim());
            }
            
            actionHtml += `<span class="action-title">${title}</span>`;
            actionHtml += '</div>';
            
            // Action details
            actionHtml += '<div class="action-metadata">';
            
            // Element details
            if (event.context?.selector) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Element:</span>
                    <code>${this.escapeHtml(event.context.selector)}</code>
                </div>`;
            }
            
            // Position - check both direct and position object
            const x = event.x !== undefined && event.x !== null ? event.x : 
                      (event.position?.x !== undefined && event.position.x !== null ? event.position.x : 'unknown');
            const y = event.y !== undefined && event.y !== null ? event.y : 
                      (event.position?.y !== undefined && event.position.y !== null ? event.position.y : 'unknown');
            actionHtml += `<div class="meta-item">
                <span class="meta-label">Position:</span>
                <span>(${x}, ${y})</span>
            </div>`;
            
            // Window/File context
            const windowTitle = event.window || event.context?.window;
            if (windowTitle && windowTitle !== 'Unknown') {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Window:</span>
                    <span class="meta-window">${this.escapeHtml(windowTitle)}</span>
                </div>`;
            }
            
            // Application context - check multiple fields
            const appName = event.activeApp?.name || event.application || event.context?.application;
            if (appName) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Application:</span>
                    <span>${this.escapeHtml(appName)}</span>
                </div>`;
            }
            
            // URL if available
            if (event.context?.url) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Page:</span>
                    <span class="meta-url">${this.escapeHtml(event.context.url)}</span>
                </div>`;
            }
            
            actionHtml += '</div>';
            
        } else if (event.type === 'keypress') {
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">⌨️</span>';
            actionHtml += `<span class="action-title">Type "${this.escapeHtml(event.key || 'key')}"</span>`;
            actionHtml += '</div>';
            
            if (event.activeApp?.name) {
                actionHtml += '<div class="action-metadata">';
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Application:</span>
                    <span>${this.escapeHtml(event.activeApp.name)}</span>
                </div>`;
                actionHtml += '</div>';
            }
            
        } else if (event.type === 'navigation') {
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">🌐</span>';
            actionHtml += '<span class="action-title">Navigate</span>';
            actionHtml += '</div>';
            
            actionHtml += '<div class="action-metadata">';
            actionHtml += `<div class="meta-item">
                <span class="meta-label">URL:</span>
                <code class="meta-url">${this.escapeHtml(event.context?.url || event.url || 'unknown')}</code>
            </div>`;
            actionHtml += '</div>';
            
        } else if (event.pythonEvent) {
            const pe = event.pythonEvent;
            
            if (pe.type === 'clipboard') {
                actionHtml += '<div class="action-header">';
                actionHtml += '<span class="action-icon">📋</span>';
                
                // Check for Excel source in clipboard
                if (pe.source?.excel_selection) {
                    const excel = pe.source.excel_selection;
                    let title = pe.action === 'copy' ? 'Copy from Excel' : 'Clipboard';
                    if (excel.address) title = `Copy ${excel.address}`;
                    if (excel.workbook) title += ` from ${excel.workbook}`;
                    actionHtml += `<span class="action-title">${this.escapeHtml(title)}</span>`;
                } else {
                    actionHtml += `<span class="action-title">Clipboard: ${pe.action || 'Operation'}</span>`;
                }
                actionHtml += '</div>';
                
                actionHtml += '<div class="action-metadata">';
                
                // Show content preview
                if (pe.content) {
                    const preview = pe.content.substring(0, 100);
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Content:</span>
                        <span class="meta-content">"${this.escapeHtml(preview)}${pe.content.length > 100 ? '...' : ''}"</span>
                    </div>`;
                }
                
                // Show Excel source details if available
                if (pe.source?.excel_selection) {
                    const excel = pe.source.excel_selection;
                    if (excel.address) {
                        actionHtml += `<div class="meta-item">
                            <span class="meta-label">Range:</span>
                            <span>${this.escapeHtml(excel.address)}</span>
                        </div>`;
                    }
                    if (excel.sheet) {
                        actionHtml += `<div class="meta-item">
                            <span class="meta-label">Sheet:</span>
                            <span>${this.escapeHtml(excel.sheet)}</span>
                        </div>`;
                    }
                    if (excel.workbook) {
                        actionHtml += `<div class="meta-item">
                            <span class="meta-label">Workbook:</span>
                            <span>${this.escapeHtml(excel.workbook)}</span>
                        </div>`;
                    }
                    if (excel.path) {
                        actionHtml += `<div class="meta-item">
                            <span class="meta-label">Path:</span>
                            <span class="meta-url">${this.escapeHtml(excel.path)}</span>
                        </div>`;
                    }
                } else if (pe.source?.document) {
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Source:</span>
                        <span>${this.escapeHtml(pe.source.document)}</span>
                    </div>`;
                }
                
                actionHtml += '</div>';
                
            } else if (pe.type === 'excel') {
                actionHtml += '<div class="action-header">';
                actionHtml += '<span class="action-icon">📊</span>';
                actionHtml += `<span class="action-title">Excel: ${pe.action || 'Operation'}</span>`;
                actionHtml += '</div>';
                
                actionHtml += '<div class="action-metadata">';
                if (pe.cell) {
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Cell:</span>
                        <span>${this.escapeHtml(pe.cell)}</span>
                    </div>`;
                }
                if (pe.value) {
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Value:</span>
                        <span>"${this.escapeHtml(pe.value)}"</span>
                    </div>`;
                }
                if (pe.sheet) {
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Sheet:</span>
                        <span>${this.escapeHtml(pe.sheet)}</span>
                    </div>`;
                }
                actionHtml += '</div>';
            }
            
        } else if (event.type === 'excel-operation') {
            // Handle Excel operations with rich context
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">📊</span>';
            
            let title = 'Excel: ';
            if (event.action === 'select' && event.address) {
                title += `Select ${event.address}`;
                if (event.workbook) title += ` in ${event.workbook}`;
            } else {
                title += event.description || 'Operation';
            }
            actionHtml += `<span class="action-title">${this.escapeHtml(title)}</span>`;
            actionHtml += '</div>';
            
            actionHtml += '<div class="action-metadata">';
            if (event.address) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Range:</span>
                    <span>${this.escapeHtml(event.address)}</span>
                </div>`;
            }
            if (event.value) {
                const valuePreview = String(event.value).substring(0, 100);
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Value:</span>
                    <span>"${this.escapeHtml(valuePreview)}${event.value.length > 100 ? '...' : ''}"</span>
                </div>`;
            }
            if (event.sheet) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Sheet:</span>
                    <span>${this.escapeHtml(event.sheet)}</span>
                </div>`;
            }
            if (event.workbook) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Workbook:</span>
                    <span>${this.escapeHtml(event.workbook)}</span>
                </div>`;
            }
            if (event.workbookPath) {
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Path:</span>
                    <span class="meta-url">${this.escapeHtml(event.workbookPath)}</span>
                </div>`;
            }
            actionHtml += '</div>';
            
        } else if (event.type === 'clipboard') {
            // Handle clipboard events with rich source
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">📋</span>';
            
            let title = event.action === 'copy' ? 'Copy' : event.action === 'paste' ? 'Paste' : 'Clipboard';
            
            // Check for Excel source
            if (event.source?.excel_selection) {
                const excel = event.source.excel_selection;
                if (excel.address) title += ` ${excel.address}`;
                if (excel.workbook) title += ` from ${excel.workbook}`;
            } else if (event.source?.document) {
                title += ` from ${event.source.document}`;
            }
            
            actionHtml += `<span class="action-title">${this.escapeHtml(title)}</span>`;
            actionHtml += '</div>';
            
            actionHtml += '<div class="action-metadata">';
            
            // Show content preview
            if (event.contentPreview || event.content) {
                const preview = event.contentPreview || event.content;
                actionHtml += `<div class="meta-item">
                    <span class="meta-label">Content:</span>
                    <span class="meta-content">"${this.escapeHtml(preview.substring(0, 100))}${preview.length > 100 ? '...' : ''}"</span>
                </div>`;
            }
            
            // Show Excel details if available
            if (event.source?.excel_selection) {
                const excel = event.source.excel_selection;
                if (excel.sheet) {
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Sheet:</span>
                        <span>${this.escapeHtml(excel.sheet)}</span>
                    </div>`;
                }
                if (excel.path) {
                    actionHtml += `<div class="meta-item">
                        <span class="meta-label">Path:</span>
                        <span class="meta-url">${this.escapeHtml(excel.path)}</span>
                    </div>`;
                }
            }
            
            actionHtml += '</div>';
            
        } else if (event.type === 'step-boundary') {
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">📍</span>';
            actionHtml += `<span class="action-title">Step: ${this.escapeHtml(event.description || 'Step boundary')}</span>`;
            actionHtml += '</div>';
            
        } else if (event.type === 'mark-before') {
            actionHtml += '<div class="action-header">';
            actionHtml += '<span class="action-icon">🎯</span>';
            actionHtml += `<span class="action-title">Intent: ${this.escapeHtml(event.description || 'User action')}</span>`;
            actionHtml += '</div>';
            
        } else {
            actionHtml += '<div class="action-header">';
            actionHtml += `<span class="action-title">${this.escapeHtml(event.type || 'Unknown action')}</span>`;
            actionHtml += '</div>';
        }
        
        actionHtml += '</div>';
        
        this.elements.actionDisplay.innerHTML = actionHtml;
    }
    
    /**
     * Display error information
     */
    displayError(data) {
        const errorHtml = `
            <div class="action-error">
                <strong>❌ Error at Step ${data.step}</strong><br>
                ${this.escapeHtml(data.error)}
            </div>
        `;
        this.elements.actionDisplay.innerHTML = errorHtml;
        
        if (data.canContinue) {
            // Could add a continue button here
        }
    }
    
    /**
     * Update step counter
     */
    updateStepCounter(current, total) {
        this.elements.stepCounter.textContent = `Step ${current} of ${total}`;
    }
    
    /**
     * Update progress bar
     */
    updateProgress(percentage, current, total) {
        this.elements.progressBar.style.width = `${percentage}%`;
        
        if (this.isReplaying && !this.isPaused) {
            const elapsed = Date.now() - this.replayStartTime;
            this.elements.timeElapsed.textContent = this.formatDuration(elapsed);
        }
    }
    
    /**
     * Reset progress display
     */
    resetProgress() {
        this.elements.progressBar.style.width = '0%';
        this.elements.stepCounter.textContent = 'Ready to replay';
        this.elements.timeElapsed.textContent = '';
        this.elements.actionDisplay.innerHTML = '<div class="action-placeholder">No replay in progress. Click "Test Replay" to validate your captured automation.</div>';
    }
    
    /**
     * Update status text
     */
    updateStatus(text) {
        this.elements.statusText.textContent = text;
    }
    
    /**
     * Add entry to replay log with enhanced formatting
     */
    addLogEntry(level, message) {
        const entry = document.createElement('div');
        entry.className = `replay-log-entry ${level}`;
        
        // Add time as data attribute for CSS ::before
        const time = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        entry.setAttribute('data-time', time);
        
        // Just the message, time is handled by CSS
        entry.textContent = message;
        
        this.elements.replayLog.appendChild(entry);
        this.elements.replayLog.scrollTop = this.elements.replayLog.scrollHeight;
        
        // Keep only last 100 entries
        this.logEntries.push(entry);
        if (this.logEntries.length > 100) {
            const oldEntry = this.logEntries.shift();
            oldEntry.remove();
        }
    }
    
    /**
     * Clear replay log
     */
    clearLog() {
        this.elements.replayLog.innerHTML = '';
        this.logEntries = [];
        this.replayStartTime = Date.now();
    }
    
    /**
     * Format duration in milliseconds to human readable
     */
    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }
    
    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.replayController = new ReplayController();
    });
} else {
    window.replayController = new ReplayController();
}