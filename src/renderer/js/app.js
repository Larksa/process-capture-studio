/**
 * Process Capture Studio - Main Application
 * Coordinates the three-panel system
 */

class ProcessCaptureApp {
    constructor() {
        this.engine = new ProcessEngine();
        this.tracker = window.activityTracker;
        this.canvas = window.canvasBuilder;
        this.chat = null; // Will be initialized when chat-guide.js loads
        
        this.isRecording = false;
        this.currentBranch = null;
        this.recordingMode = 'linear'; // 'linear', 'branch', 'review'
        
        this.initialize();
    }

    /**
     * Initialize the application
     */
    initialize() {
        // Setup engine observers
        this.engine.subscribe((event, data) => {
            this.handleEngineEvent(event, data);
        });
        
        // Setup UI event handlers
        this.setupUIHandlers();
        
        // Load saved session if exists
        this.loadSession();
        
        // Initialize dialogs
        this.setupDialogs();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Listen for system-wide capture events from main process
        this.setupElectronListeners();
        
        console.log('Process Capture Studio initialized');
    }

    /**
     * Setup UI event handlers
     */
    setupUIHandlers() {
        // Window controls
        this.setupWindowControls();
        
        // Capture controls
        document.getElementById('start-capture').addEventListener('click', () => {
            this.startCapture();
        });
        
        document.getElementById('pause-capture').addEventListener('click', () => {
            this.pauseCapture();
        });
        
        document.getElementById('stop-capture').addEventListener('click', () => {
            this.stopCapture();
        });
        
        // Mark important button
        document.getElementById('mark-important').addEventListener('click', () => {
            this.markCurrentAsImportant();
        });
        
        // Export menu
        document.getElementById('export-menu').addEventListener('click', (e) => {
            this.showExportDialog();
        });
        
        // Export format buttons
        document.querySelectorAll('.export-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exportProcess(btn.dataset.format);
            });
        });
        
        // Chat input
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message) {
                this.handleUserMessage(message);
                chatInput.value = '';
            }
        };
        
        sendButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Filter checkboxes
        document.querySelectorAll('.filter-bar input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.tracker.filters[e.target.id.replace('filter-', '')] = e.target.checked;
            });
        });
    }

    /**
     * Setup window controls
     */
    setupWindowControls() {
        // Always on top toggle
        const alwaysOnTopCheckbox = document.getElementById('always-on-top');
        alwaysOnTopCheckbox.addEventListener('change', (e) => {
            window.electronAPI.setAlwaysOnTop(e.target.checked);
            if (e.target.checked) {
                this.showNotification('Window pinned to top');
            }
        });
        
        // Opacity control
        const opacitySlider = document.getElementById('window-opacity');
        const opacityValue = document.getElementById('opacity-value');
        
        opacitySlider.addEventListener('input', (e) => {
            const opacity = e.target.value / 100;
            opacityValue.textContent = `${e.target.value}%`;
            window.electronAPI.setOpacity(opacity);
        });
        
        // Auto-close dialog on window blur
        window.addEventListener('blur', () => {
            const stepDialog = document.getElementById('step-dialog');
            if (!stepDialog.classList.contains('hidden')) {
                // Save dialog state
                this.saveDialogState();
                stepDialog.classList.add('hidden');
            }
        });
        
        // Restore dialog on focus if needed
        window.addEventListener('focus', () => {
            if (this.pendingDialogRestore) {
                this.restoreDialogState();
            }
        });
    }
    
    /**
     * Save dialog state before hiding
     */
    saveDialogState() {
        const actionType = document.getElementById('action-type')?.value;
        const stepLogic = document.getElementById('step-logic')?.value; // Fixed: was 'action-reason'
        const dataSource = document.getElementById('data-source')?.value;
        
        if (actionType || stepLogic || dataSource) {
            this.pendingDialogRestore = {
                actionType,
                stepLogic,
                dataSource
            };
        }
    }
    
    /**
     * Restore dialog state
     */
    restoreDialogState() {
        if (!this.pendingDialogRestore) return;
        
        const dialog = document.getElementById('step-dialog');
        const actionType = document.getElementById('action-type');
        const stepLogic = document.getElementById('step-logic'); // Fixed: was 'action-reason'
        const dataSource = document.getElementById('data-source');
        
        if (actionType) actionType.value = this.pendingDialogRestore.actionType || '';
        if (stepLogic) stepLogic.value = this.pendingDialogRestore.stepLogic || '';
        if (dataSource) dataSource.value = this.pendingDialogRestore.dataSource || '';
        
        if (dialog) dialog.classList.remove('hidden');
        this.pendingDialogRestore = null;
    }
    
    /**
     * Setup dialogs
     */
    setupDialogs() {
        // Step capture dialog
        const stepDialog = document.getElementById('step-dialog');
        
        document.getElementById('capture-step').addEventListener('click', () => {
            this.captureStepFromDialog();
            stepDialog.classList.add('hidden');
        });
        
        document.getElementById('skip-step').addEventListener('click', () => {
            stepDialog.classList.add('hidden');
        });
        
        document.getElementById('go-back').addEventListener('click', () => {
            this.showPreviousStepDialog();
            stepDialog.classList.add('hidden');
        });
        
        // Action type changes
        document.getElementById('action-type').addEventListener('change', (e) => {
            if (e.target.value === 'decision') {
                document.getElementById('decision-branches').classList.remove('hidden');
            } else {
                document.getElementById('decision-branches').classList.add('hidden');
            }
        });
        
        // Export dialog
        document.getElementById('copy-export').addEventListener('click', () => {
            const preview = document.getElementById('export-preview');
            navigator.clipboard.writeText(preview.value);
            this.showNotification('Copied to clipboard!');
        });
        
        document.getElementById('download-export').addEventListener('click', () => {
            this.downloadExport();
        });
        
        document.getElementById('close-export').addEventListener('click', () => {
            document.getElementById('export-dialog').classList.add('hidden');
        });
    }

    /**
     * Setup Electron IPC listeners
     */
    setupElectronListeners() {
        if (!window.electronAPI) {
            console.warn('Electron API not available');
            return;
        }

        // Listen for system-wide capture events
        window.electronAPI.onCaptureActivity((activity) => {
            console.log('Received system-wide activity:', activity);
            
            // Add to activity tracker
            if (this.tracker) {
                this.tracker.addActivity(activity);
            }
            
            // Handle special activities
            if (activity.type === 'app_switch') {
                this.addChatMessage('ai', `Switched to ${activity.application || 'unknown app'}`);
            }
        });

        // Listen for global shortcuts
        window.electronAPI.onShortcut('mark-important', () => {
            this.markCurrentAsImportant();
        });

        window.electronAPI.onShortcut('toggle-capture', () => {
            if (this.isRecording) {
                this.pauseCapture();
            } else {
                this.startCapture();
            }
        });

        window.electronAPI.onShortcut('export', () => {
            this.showExportDialog();
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+M - Mark important
            if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                this.markCurrentAsImportant();
            }
            
            // Ctrl+Shift+S - Start/stop capture
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                if (this.isRecording) {
                    this.pauseCapture();
                } else {
                    this.startCapture();
                }
            }
            
            // Ctrl+E - Export
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.showExportDialog();
            }
            
            // Ctrl+Z - Undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.engine.undo();
            }
            
            // Ctrl+Shift+Z - Redo
            if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
                e.preventDefault();
                this.engine.redo();
            }
        });
    }

    /**
     * Start capture
     */
    startCapture() {
        this.isRecording = true;
        this.tracker.startCapture();
        
        // CRITICAL: Tell main process to start system-wide capture
        if (window.electronAPI) {
            window.electronAPI.startCapture();
            console.log('Started system-wide capture');
        }
        
        // Update UI
        document.getElementById('start-capture').disabled = true;
        document.getElementById('pause-capture').disabled = false;
        document.getElementById('stop-capture').disabled = false;
        
        // Update global recording status
        const globalStatus = document.getElementById('global-recording-status');
        globalStatus.classList.add('recording');
        globalStatus.querySelector('span:last-child').textContent = 'Recording...';
        
        // Update capture status
        const captureStatus = document.getElementById('capture-status');
        captureStatus.querySelector('.status-text').textContent = 'Recording...';
        captureStatus.querySelector('.status-dot').style.background = '#f44336';
        
        // Add chat message
        this.addChatMessage('ai', "Recording started. Perform your process normally. Press Ctrl+Shift+M to mark important steps.");
    }

    /**
     * Pause capture
     */
    pauseCapture() {
        this.isRecording = false;
        this.tracker.stopCapture();
        
        // Update UI
        document.getElementById('start-capture').disabled = false;
        document.getElementById('pause-capture').disabled = true;
        document.getElementById('stop-capture').disabled = false;
        
        // Update global recording status
        const globalStatus = document.getElementById('global-recording-status');
        globalStatus.classList.remove('recording');
        globalStatus.querySelector('span:last-child').textContent = 'Paused';
        
        // Update capture status
        const captureStatus = document.getElementById('capture-status');
        captureStatus.querySelector('.status-text').textContent = 'Paused';
        captureStatus.querySelector('.status-dot').style.background = '#ff9800';
        
        // Add chat message
        this.addChatMessage('ai', "Recording paused. You can review the captured steps or continue recording.");
    }

    /**
     * Stop capture completely
     */
    stopCapture() {
        this.isRecording = false;
        this.tracker.stopCapture();
        
        // Update UI
        document.getElementById('start-capture').disabled = false;
        document.getElementById('pause-capture').disabled = true;
        document.getElementById('stop-capture').disabled = true;
        
        // Update global recording status
        const globalStatus = document.getElementById('global-recording-status');
        globalStatus.classList.remove('recording');
        globalStatus.querySelector('span:last-child').textContent = 'Stopped';
        
        // Update capture status
        const captureStatus = document.getElementById('capture-status');
        captureStatus.querySelector('.status-text').textContent = 'Ready';
        captureStatus.querySelector('.status-dot').style.background = '#4caf50';
        
        // Add chat message with summary
        const nodeCount = this.engine.process.nodes.size;
        this.addChatMessage('ai', `Recording stopped. Captured ${nodeCount} steps. You can now export your process or start a new recording.`);
        
        // Notify main process to stop system-wide capture
        if (window.electronAPI) {
            window.electronAPI.stopCapture();
        }
    }

    /**
     * Mark current moment as important
     */
    markCurrentAsImportant() {
        const activity = this.tracker.activityBuffer[this.tracker.activityBuffer.length - 1];
        
        if (activity) {
            this.showStepDialog(activity);
        } else {
            // Create manual marker
            this.showStepDialog({
                type: 'manual',
                timestamp: Date.now(),
                context: this.tracker.getCurrentContext()
            });
        }
    }

    /**
     * Show step capture dialog
     */
    showStepDialog(activity) {
        const dialog = document.getElementById('step-dialog');
        const detectedContext = document.getElementById('detected-context');
        
        // Show detected context
        detectedContext.innerHTML = this.formatDetectedContext(activity);
        
        // Store current activity
        this.currentActivity = activity;
        
        // Show dialog
        dialog.classList.remove('hidden');
        
        // Focus on action type
        document.getElementById('action-type').focus();
    }

    /**
     * Format detected context for display
     */
    formatDetectedContext(activity) {
        let html = '<strong>Detected:</strong><br>';
        
        if (activity.type) {
            html += `Action: ${activity.type}<br>`;
        }
        
        if (activity.context?.application) {
            html += `Application: ${activity.context.application}<br>`;
        }
        
        if (activity.context?.url) {
            html += `URL: ${new URL(activity.context.url).pathname}<br>`;
        }
        
        if (activity.element?.text) {
            html += `Element: ${activity.element.text.substring(0, 50)}<br>`;
        }
        
        if (activity.key) {
            html += `Keys: ${activity.key}<br>`;
        }
        
        return html;
    }

    /**
     * Capture step from dialog
     */
    captureStepFromDialog() {
        const actionType = document.getElementById('action-type')?.value || 'custom';
        const logic = document.getElementById('step-logic')?.value || '';
        const dataSource = document.getElementById('data-source')?.value || '';
        
        // Build node data
        const nodeData = {
            id: crypto.randomUUID(),
            type: actionType === 'decision' ? 'decision' : 'action',
            actionType: actionType,
            description: this.generateDescription(actionType, this.currentActivity),
            timestamp: this.currentActivity.timestamp,
            
            // Include all captured context
            element: this.currentActivity.element,
            application: this.currentActivity.context?.application,
            url: this.currentActivity.context?.url,
            windowTitle: this.currentActivity.context?.title,
            
            // Logic and reasoning
            reason: logic,
            rule: this.extractRule(logic),
            
            // Data flow
            input: dataSource ? {
                source: 'user_specified',
                sourceDetails: dataSource
            } : null,
            
            // Previous node connection
            previousId: this.engine.process.currentNodeId
        };
        
        // Handle decision branches
        if (actionType === 'decision') {
            nodeData.branches = this.collectBranches();
        }
        
        // Create node in engine
        const node = this.engine.createNode(nodeData);
        
        // Add to canvas
        this.canvas.addNode(node);
        
        // Add chat confirmation
        this.addChatMessage('ai', `Captured: ${node.action.description}`);
        
        // Check if we need more context
        if (dataSource && dataSource.includes('file')) {
            this.promptForFileNavigation(dataSource);
        }
    }

    /**
     * Generate description from activity
     */
    generateDescription(actionType, activity) {
        const descriptions = {
            'click': `Click ${activity.element?.text || 'button'}`,
            'type': `Enter data in ${activity.field?.label || 'field'}`,
            'copy': 'Copy data',
            'paste': 'Paste data',
            'navigate': `Navigate to ${activity.context?.title || 'page'}`,
            'decision': 'Make decision',
            'wait': 'Wait for process',
            'file': `Work with file ${activity.fileName || ''}`,
            'custom': 'Perform action',
            'manual': 'Manual step'
        };
        
        return descriptions[actionType] || 'Perform action';
    }

    /**
     * Extract IF-THEN rule from logic text
     */
    extractRule(logic) {
        const match = logic.match(/if\s+(.*?)\s+then\s+(.*)/i);
        if (match) {
            return `IF ${match[1]} THEN ${match[2]}`;
        }
        return logic;
    }

    /**
     * Collect branches from dialog
     */
    collectBranches() {
        const branches = [];
        const branchInputs = document.querySelectorAll('#branch-list input');
        
        branchInputs.forEach(input => {
            if (input.value.trim()) {
                branches.push({
                    id: crypto.randomUUID(),
                    condition: input.value.trim(),
                    label: input.value.trim(),
                    recorded: false
                });
            }
        });
        
        return branches;
    }

    /**
     * Handle user chat message
     */
    handleUserMessage(message) {
        // Add user message to chat
        this.addChatMessage('user', message);
        
        // Process message
        if (message.toLowerCase().includes('help')) {
            this.showHelp();
        } else if (message.toLowerCase().includes('undo')) {
            this.engine.undo();
            this.addChatMessage('ai', 'Last action undone.');
        } else if (message.toLowerCase().includes('export')) {
            this.showExportDialog();
        } else {
            // Context for current step
            if (this.engine.process.currentNodeId) {
                const node = this.engine.process.nodes.get(this.engine.process.currentNodeId);
                if (node) {
                    // Update node with user context
                    this.engine.updateNode(node.id, {
                        metadata: {
                            ...node.metadata,
                            userContext: message
                        }
                    });
                    
                    this.addChatMessage('ai', 'Context added to current step.');
                }
            }
        }
    }

    /**
     * Add message to chat
     */
    addChatMessage(sender, text) {
        const chatMessages = document.getElementById('chat-messages');
        
        const message = document.createElement('div');
        message.className = `message ${sender}`;
        message.innerHTML = `<div class="message-content">${text}</div>`;
        
        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Show export dialog
     */
    showExportDialog() {
        const dialog = document.getElementById('export-dialog');
        dialog.classList.remove('hidden');
        
        // Default to JSON
        this.exportProcess('json');
    }

    /**
     * Export process in specified format
     */
    exportProcess(format) {
        const exportData = this.engine.exportForAutomation(format);
        const preview = document.getElementById('export-preview');
        
        preview.value = exportData;
        
        // Update selected button
        document.querySelectorAll('.export-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
    }

    /**
     * Download export file
     */
    downloadExport() {
        const preview = document.getElementById('export-preview');
        const format = document.querySelector('.export-option.selected')?.dataset.format || 'json';
        
        const extensions = {
            'json': 'json',
            'yaml': 'yaml',
            'mermaid': 'md',
            'playwright': 'js',
            'documentation': 'md'
        };
        
        const blob = new Blob([preview.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `process-${Date.now()}.${extensions[format]}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Handle engine events
     */
    handleEngineEvent(event, data) {
        switch (event) {
            case 'nodeCreated':
                // Canvas is updated separately
                break;
            case 'nodeUpdated':
                // Update canvas node
                this.canvas.updateNode(data);
                break;
            case 'edgeAdded':
                // Canvas handles this
                break;
        }
    }

    /**
     * Handle activity from tracker
     */
    handleActivity(activity) {
        // Auto-create nodes for important activities
        if (activity.isImportant || this.shouldAutoCapture(activity)) {
            // Show dialog for context
            this.showStepDialog(activity);
        }
    }

    /**
     * Should auto-capture activity
     */
    shouldAutoCapture(activity) {
        return activity.type === 'file_operation' ||
               activity.type === 'app_switch' ||
               (activity.type === 'keystroke' && activity.isImportant);
    }

    /**
     * Prompt for file navigation
     */
    promptForFileNavigation(source) {
        this.addChatMessage('ai', `You mentioned getting data from "${source}". Would you like to show me where that file is located? Click "Start Recording" and navigate to the file.`);
        
        // Add quick reply
        this.addQuickReply('Show file location', () => {
            this.startFileNavigation();
        });
    }

    /**
     * Add quick reply button
     */
    addQuickReply(text, callback) {
        const container = document.getElementById('quick-replies');
        
        const button = document.createElement('button');
        button.className = 'quick-reply';
        button.textContent = text;
        button.onclick = () => {
            callback();
            button.remove();
        };
        
        container.appendChild(button);
    }

    /**
     * Start file navigation recording
     */
    startFileNavigation() {
        this.recordingMode = 'file_navigation';
        this.addChatMessage('ai', 'Recording file navigation. Navigate to your file and I\'ll capture the path.');
        
        // Start capture if not already
        if (!this.isRecording) {
            this.startCapture();
        }
    }

    /**
     * Node selected in canvas
     */
    onNodeSelected(nodeData) {
        // Show node details in chat
        this.addChatMessage('ai', `Selected: ${nodeData.action?.description || nodeData.title}`);
        
        // Add quick actions
        this.addQuickReply('Continue from here', () => {
            this.continueFromNode(nodeData.id);
        });
        
        if (nodeData.type === 'decision') {
            this.addQuickReply('Record branch', () => {
                this.startBranchRecording(nodeData.id);
            });
        }
    }

    /**
     * Continue from a specific node
     */
    continueFromNode(nodeId) {
        this.engine.process.currentNodeId = nodeId;
        this.addChatMessage('ai', 'Continuing from selected step. Your next actions will be added after this point.');
    }

    /**
     * Start recording a branch
     */
    startBranchRecording(nodeId) {
        const node = this.engine.process.nodes.get(nodeId);
        if (!node || !node.branches) return;
        
        // Find unrecorded branch
        const unrecorded = node.branches.find(b => !b.recorded);
        
        if (unrecorded) {
            this.currentBranch = unrecorded;
            this.recordingMode = 'branch';
            
            this.addChatMessage('ai', `Recording branch: "${unrecorded.label}". Perform the steps for this condition.`);
            
            // Start capture
            if (!this.isRecording) {
                this.startCapture();
            }
        }
    }

    /**
     * Show help
     */
    showHelp() {
        const help = `
            **Keyboard Shortcuts:**
            - Ctrl+Shift+M: Mark current as important step
            - Ctrl+Shift+S: Start/stop recording
            - Ctrl+E: Export process
            - Ctrl+Z: Undo
            - Ctrl+Shift+Z: Redo
            
            **Tips:**
            - Click any node to select it
            - Double-click to edit
            - Shift+drag to move nodes
            - Right-click for options
        `;
        
        this.addChatMessage('ai', help);
    }

    /**
     * Show notification
     */
    showNotification(message) {
        // Simple notification (enhance with better UI)
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            animation: slideIn 0.3s;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Load saved session
     */
    loadSession() {
        // Session is auto-loaded by ProcessEngine
        // Rebuild canvas from saved data
        if (this.engine.process.nodes.size > 0) {
            for (const [nodeId, node] of this.engine.process.nodes) {
                this.canvas.addNode(node);
            }
            
            for (const edge of this.engine.process.edges) {
                this.canvas.drawConnection(edge.from, edge.to, edge.type, edge.label);
            }
            
            this.addChatMessage('ai', `Loaded previous session with ${this.engine.process.nodes.size} steps.`);
        }
    }

    /**
     * Event handlers for external access
     */
    onCaptureStart() {
        console.log('Capture started');
    }

    onCaptureStop() {
        console.log('Capture stopped');
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.processApp = new ProcessCaptureApp();
    
    // Make engine accessible for debugging
    window.processEngine = window.processApp.engine;
    
    console.log('Process Capture Studio ready!');
    console.log('Press Ctrl+Shift+M to mark important steps');
    console.log('Press Ctrl+Shift+S to start/stop recording');
});