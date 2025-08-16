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
     * Display current action being executed
     */
    displayCurrentAction(event) {
        let actionHtml = '<div class="action-details">';
        
        if (event.type === 'click') {
            actionHtml += `<strong>🖱️ Click</strong>`;
            if (event.context?.selector) {
                actionHtml += `<br>Element: <code>${this.escapeHtml(event.context.selector)}</code>`;
            }
            if (event.context?.text) {
                actionHtml += `<br>Text: "${this.escapeHtml(event.context.text)}"`;
            }
            actionHtml += `<br>Position: (${event.x}, ${event.y})`;
            
        } else if (event.type === 'keypress') {
            actionHtml += `<strong>⌨️ Type</strong>`;
            actionHtml += `<br>Key: <code>${this.escapeHtml(event.key)}</code>`;
            
        } else if (event.type === 'navigation') {
            actionHtml += `<strong>🌐 Navigate</strong>`;
            actionHtml += `<br>URL: <code>${this.escapeHtml(event.context?.url)}</code>`;
            
        } else if (event.pythonEvent) {
            const pe = event.pythonEvent;
            if (pe.type === 'clipboard') {
                actionHtml += `<strong>📋 Clipboard</strong>`;
                actionHtml += `<br>Action: ${pe.action}`;
                if (pe.content) {
                    actionHtml += `<br>Content: "${this.escapeHtml(pe.content)}"`;
                }
            } else if (pe.type === 'excel') {
                actionHtml += `<strong>📊 Excel</strong>`;
                actionHtml += `<br>Action: ${pe.action}`;
                if (pe.cell) {
                    actionHtml += `<br>Cell: ${pe.cell}`;
                }
            }
        } else {
            actionHtml += `<strong>${event.type}</strong>`;
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
     * Add entry to replay log
     */
    addLogEntry(level, message) {
        const entry = document.createElement('div');
        entry.className = `replay-log-entry ${level}`;
        entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        
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