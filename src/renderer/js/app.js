/**
 * Process Capture Studio - Main Application
 * Coordinates the three-panel system
 */

// Fallback UUID generator if crypto.randomUUID is not available
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();  // FIXED: Was calling itself!
    }
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class ProcessCaptureApp {
    constructor() {
        this.engine = new ProcessEngine();
        this.tracker = window.activityTracker;
        this.canvas = window.canvasBuilder;
        this.chat = null; // Will be initialized when chat-guide.js loads
        
        this.isRecording = false;
        this.currentBranch = null;
        this.recordingMode = 'linear'; // 'linear', 'branch', 'review'
        this.isSavingMark = false; // Flag to prevent duplicate saves
        
        // Store element references to prevent loss
        this.elements = {};
        
        // Store bound event handlers so we can remove them
        this.handlers = {};
        
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
        
        // Connect canvas to engine as observer
        this.engine.subscribe((event, data) => {
            if (this.canvas && this.canvas.handleEngineUpdate) {
                this.canvas.handleEngineUpdate(event, data);
            } else {
                // Try to get canvas reference and retry
                if (window.canvasBuilder && window.canvasBuilder.handleEngineUpdate) {
                    this.canvas = window.canvasBuilder;
                    this.canvas.handleEngineUpdate(event, data);
                }
            }
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
        
        // Ensure canvas is properly referenced
        this.ensureCanvasReference();
        
        console.log('Process Capture Studio initialized');
    }

    /**
     * Ensure canvas reference is properly set
     */
    ensureCanvasReference() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupCanvasReference();
            });
        } else {
            this.setupCanvasReference();
        }
    }

    /**
     * Setup canvas reference
     */
    setupCanvasReference() {
        // Try multiple ways to get canvas reference
        if (window.canvasBuilder) {
            this.canvas = window.canvasBuilder;
            console.log('Canvas reference set from window.canvasBuilder');
        } else if (window.canvas) {
            this.canvas = window.canvas;
            console.log('Canvas reference set from window.canvas');
        } else {
            // Wait a bit and try again
            setTimeout(() => {
                if (window.canvasBuilder) {
                    this.canvas = window.canvasBuilder;
                    console.log('Canvas reference set from window.canvasBuilder (delayed)');
                } else {
                    console.warn('Canvas reference not found - some features may not work');
                }
            }, 500);
        }
    }

    /**
     * Setup UI event handlers
     */
    setupUIHandlers() {
        console.log('Setting up UI handlers');
        
        // Store element references
        this.elements = {
            startCapture: document.getElementById('start-capture'),
            pauseCapture: document.getElementById('pause-capture'),
            stopCapture: document.getElementById('stop-capture'),
            launchBrowser: document.getElementById('launch-browser'),
            browserStatus: document.getElementById('browser-status-text'),
            saveProcess: document.getElementById('save-process'),
            clearCapture: document.getElementById('clear-capture'),
            refreshApp: document.getElementById('refresh-app'),
            markImportant: document.getElementById('mark-important'),
            exportMenu: document.getElementById('export-menu'),
            chatInput: document.getElementById('chat-input'),
            sendMessage: document.getElementById('send-message'),
            activityFeed: document.getElementById('activity-feed'),
            chatMessages: document.getElementById('chat-messages'),
            nodeCount: document.getElementById('node-count'),
            branchCount: document.getElementById('branch-count'),
            completionStatus: document.getElementById('completion-status')
        };
        
        // DON'T remove listeners on initial setup, only on recovery
        // this.removeEventListeners();
        
        // Window controls
        this.setupWindowControls();
        
        // Capture controls
        if (this.elements.startCapture) {
            this.elements.startCapture.addEventListener('click', () => {
                this.startCapture();
            });
        }
        
        if (this.elements.pauseCapture) {
            this.elements.pauseCapture.addEventListener('click', () => {
                this.pauseCapture();
            });
        }
        
        if (this.elements.stopCapture) {
            this.elements.stopCapture.addEventListener('click', () => {
                this.stopCapture();
            });
        }
        
        // Launch capture browser button
        if (this.elements.launchBrowser) {
            this.elements.launchBrowser.addEventListener('click', async () => {
                console.log('Launching capture browser...');
                this.elements.launchBrowser.disabled = true;
                this.elements.launchBrowser.textContent = '⏳ Launching...';
                
                try {
                    const result = await window.electronAPI.launchCaptureBrowser();
                    if (result.success) {
                        console.log('Capture browser launched successfully');
                        this.elements.launchBrowser.textContent = '✅ Browser Launched';
                        
                        // Check status after a moment
                        setTimeout(async () => {
                            await this.checkBrowserStatus();
                            this.elements.launchBrowser.textContent = '🌐 Launch Capture Browser';
                            this.elements.launchBrowser.disabled = false;
                        }, 3000);
                    } else {
                        console.error('Failed to launch browser:', result.message);
                        this.elements.launchBrowser.textContent = '❌ Launch Failed';
                        setTimeout(() => {
                            this.elements.launchBrowser.textContent = '🌐 Launch Capture Browser';
                            this.elements.launchBrowser.disabled = false;
                        }, 2000);
                    }
                } catch (error) {
                    console.error('Error launching browser:', error);
                    this.elements.launchBrowser.textContent = '❌ Error';
                    setTimeout(() => {
                        this.elements.launchBrowser.textContent = '🌐 Launch Capture Browser';
                        this.elements.launchBrowser.disabled = false;
                    }, 2000);
                }
            });
        }
        
        // Save button - manually save the process
        if (this.elements.saveProcess) {
            this.elements.saveProcess.addEventListener('click', () => {
                this.saveProcess();
            });
        }
        
        // Clear button - clears all captured data
        if (this.elements.clearCapture) {
            this.elements.clearCapture.addEventListener('click', () => {
                this.clearAllData();
            });
        }
        
        // Refresh button - refreshes the entire application
        if (this.elements.refreshApp) {
            this.elements.refreshApp.addEventListener('click', () => {
                this.refreshApplication();
            });
        }
        
        // Test clear button - for debugging
        const testClearBtn = document.getElementById('test-clear');
        if (testClearBtn) {
            testClearBtn.addEventListener('click', () => {
                this.testClearFunctionality();
            });
        }
        
        // Mark important button
        if (this.elements.markImportant) {
            this.elements.markImportant.addEventListener('click', () => {
                this.markCurrentAsImportant();
            });
        }
        
        // Export menu
        if (this.elements.exportMenu) {
            this.elements.exportMenu.addEventListener('click', (e) => {
                this.showExportDialog();
            });
        }
        
        // Export format buttons
        document.querySelectorAll('.export-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exportProcess(btn.dataset.format);
            });
        });
        
        // Chat input
        if (this.elements.chatInput && this.elements.sendMessage) {
            const sendMessage = () => {
                const message = this.elements.chatInput.value.trim();
                if (message) {
                    this.handleUserMessage(message);
                    this.elements.chatInput.value = '';
                }
            };
            
            this.elements.sendMessage.addEventListener('click', sendMessage);
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
        
        // Filter checkboxes
        document.querySelectorAll('.filter-bar input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (this.tracker && this.tracker.filters) {
                    this.tracker.filters[e.target.id.replace('filter-', '')] = e.target.checked;
                }
            });
        });
        
        console.log('UI handlers setup complete');
    }
    
    /**
     * Remove event listeners (to prevent duplicates)
     */
    removeEventListeners() {
        // Don't clone elements - this breaks references
        // Instead, we'll just be careful not to add duplicate listeners
        console.log('Skipping removeEventListeners to preserve element references');
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
        
        // Listen for browser status updates
        window.electronAPI.onBrowserStatusUpdate((status) => {
            console.log('Browser status update:', status);
            this.updateBrowserStatus(status);
        });
        
        // Check initial browser status
        this.checkBrowserStatus();

        // Listen for mark mode events
        window.electronAPI.onMarkModeStarted((data) => {
            this.showMarkModeIndicator(data);
        });
        
        window.electronAPI.onMarkModeStopped((data) => {
            this.hideMarkModeIndicator();
        });
        
        window.electronAPI.onMarkCompleted((data) => {
            this.handleMarkCompleted(data);
        });
        
        // Listen for immediate intent prompt
        window.electronAPI.onMarkBeforePrompt(() => {
            console.log('[App] Received mark-before:prompt - showing intent dialog');
            this.showIntentDialog();
        });

        // Listen for inactivity detection during Mark Before
        window.electronAPI.onMarkInactivityDetected((data) => {
            console.log('[App] Inactivity detected during Mark Before:', data);
            this.showInactivityDialog(data);
        });
        
        // Listen for side quest events
        window.electronAPI.onSideQuestStarted((sideQuest) => {
            console.log('[App] Side quest started:', sideQuest);
            this.updateMarkModeStatus({ sideQuest: true, description: sideQuest.description });
        });
        
        window.electronAPI.onSideQuestCompleted((data) => {
            console.log('[App] Side quest completed:', data);
            this.updateMarkModeStatus({ sideQuest: false });
        });
        
        window.electronAPI.onCaptureResumed(() => {
            console.log('[App] Capture resumed after pause');
            this.updateMarkModeStatus({ paused: false });
        });

        // Listen for global shortcuts - Mark Before pattern
        window.electronAPI.onShortcut('mark-important', () => {
            this.startMarkMode();
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
            // Ctrl+S - Save process (without Shift)
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
                e.preventDefault();
                this.saveProcess();
            }
            
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
     * Save the current process manually
     */
    saveProcess() {
        console.log('📁 SaveProcess: Starting manual save...');
        try {
            const nodeCount = this.engine.process.nodes.size;
            console.log(`📁 SaveProcess: Saving ${nodeCount} nodes to localStorage`);
            
            if (this.engine.saveManual()) {
                console.log('✅ SaveProcess: Save successful!');
                this.showNotification('Process saved successfully!');
                this.updateSaveIndicator(false);
                
                // Log what was saved
                const savedData = localStorage.getItem('process_capture_data');
                if (savedData) {
                    const dataSize = (savedData.length / 1024).toFixed(2);
                    console.log(`📁 SaveProcess: Saved ${dataSize}KB to localStorage`);
                }
            } else {
                console.error('❌ SaveProcess: Save failed - engine.saveManual() returned false');
                this.showNotification('Failed to save process', 'error');
            }
        } catch (error) {
            console.error('❌ SaveProcess: Error during save:', error);
            this.showNotification('Error saving process', 'error');
        }
    }
    
    /**
     * Update save indicator
     */
    updateSaveIndicator(hasUnsavedChanges) {
        const saveBtn = this.elements.saveProcess;
        if (saveBtn) {
            if (hasUnsavedChanges) {
                saveBtn.classList.add('has-changes');
                saveBtn.textContent = '💾 Save*';
            } else {
                saveBtn.classList.remove('has-changes');
                saveBtn.textContent = '💾 Save';
            }
        }
    }

    /**
     * Clear all captured data and start fresh
     */
    clearAllData() {
        console.log('🗑️ ClearAllData: Clear button clicked');
        
        // Check for unsaved changes
        let confirmMessage = 'Are you sure you want to clear all captured data? This cannot be undone.';
        if (this.engine && this.engine.getHasUnsavedChanges()) {
            console.log('⚠️ ClearAllData: Detected unsaved changes');
            confirmMessage = 'You have unsaved changes. Are you sure you want to clear all captured data? This cannot be undone.';
        }
        
        // Confirm before clearing
        const confirmed = confirm(confirmMessage);
        
        if (confirmed) {
            console.log('✅ ClearAllData: User confirmed clear action');
            
            try {
                // Stop capture if running
                if (this.isRecording) {
                    this.stopCapture();
                }
                
                // Clear activity tracker
                console.log('🗑️ ClearAllData: Clearing activity tracker...');
                if (this.tracker) {
                    this.tracker.clearLog();
                    console.log('✅ ClearAllData: Activity tracker buffer cleared');
                }
                if (this.elements.activityFeed) {
                    this.elements.activityFeed.innerHTML = '';
                    console.log('✅ ClearAllData: Activity feed DOM cleared');
                }
                
                // Clear process engine
                console.log('🗑️ ClearAllData: Clearing process engine...');
                if (this.engine) {
                    const nodeCountBefore = this.engine.process.nodes.size;
                    this.engine.clearProcess();
                    console.log(`✅ ClearAllData: Process engine cleared (had ${nodeCountBefore} nodes)`);
                }
                
                // Clear canvas - MOST IMPORTANT
                console.log('🗑️ ClearAllData: Clearing canvas...');
                if (this.canvas) {
                    console.log('✅ ClearAllData: Canvas reference found, calling canvas.clear()');
                    this.canvas.clear();
                    console.log('✅ ClearAllData: Canvas cleared successfully');
                } else {
                    console.error('❌ ClearAllData: Canvas object not found in this.canvas!');
                    // Try to get canvas from window object
                    if (window.canvasBuilder) {
                        console.log('🔍 ClearAllData: Found canvas in window.canvasBuilder, attempting clear...');
                        this.canvas = window.canvasBuilder;
                        this.canvas.clear();
                        console.log('✅ ClearAllData: Canvas cleared via window.canvasBuilder');
                    } else {
                        console.error('❌ ClearAllData: Canvas not found in window object either');
                        // Force page refresh as last resort
                        if (confirm('Canvas not found. Would you like to refresh the page to fix this?')) {
                            window.location.reload();
                            return;
                        }
                    }
                }
                
                // Clear chat messages (keep welcome message)
                if (this.elements.chatMessages) {
                    this.elements.chatMessages.innerHTML = `
                        <div class="message ai">
                            <div class="message-content">
                                👋 Welcome to Process Capture Studio! I'll help you document your workflow. 
                                Start by clicking "Start Capture" and then perform your normal process. 
                                Press Ctrl+Shift+M to mark important steps.
                            </div>
                        </div>
                    `;
                }
                
                // Verify localStorage is cleared
                const remainingData = localStorage.getItem('process_capture_data');
                if (remainingData) {
                    console.error('⚠️ ClearAllData: localStorage still contains data after clear!');
                    console.log('⚠️ ClearAllData: Attempting to force clear localStorage...');
                    localStorage.removeItem('process_capture_data');
                } else {
                    console.log('✅ ClearAllData: localStorage verified as empty');
                }
                
                // Final verification
                console.log('📊 ClearAllData: Final state check:');
                console.log(`  - Nodes in engine: ${this.engine.process.nodes.size}`);
                console.log(`  - Canvas nodes: ${this.canvas ? this.canvas.nodes.size : 'N/A'}`);
                console.log(`  - localStorage: ${localStorage.getItem('process_capture_data') ? 'HAS DATA' : 'EMPTY'}`);
                
                // Update status
                console.log('✅ ClearAllData: All clear operations completed');
                this.addChatMessage('ai', '🗑️ All data cleared. Ready to start a fresh capture!');
                
                // Update canvas status
                if (this.elements.nodeCount) this.elements.nodeCount.textContent = '0 steps';
                if (this.elements.branchCount) this.elements.branchCount.textContent = '0 branches';
                if (this.elements.completionStatus) this.elements.completionStatus.textContent = '0% mapped';
                
                console.log('Clear operation completed successfully');
                
                // CRITICAL: Recover UI state after clear
                this.recoverUIState();
                
                // Force a visual refresh
                setTimeout(() => {
                    this.forceVisualRefresh();
                }, 100);
                
            } catch (error) {
                console.error('Error during clear operation:', error);
                alert('An error occurred while clearing data. Please refresh the page.');
            }
        }
    }

    /**
     * Force visual refresh of the canvas
     */
    forceVisualRefresh() {
        console.log('Forcing visual refresh');
        
        try {
            // Force canvas container refresh
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                // Trigger a reflow
                canvasContainer.style.display = 'none';
                canvasContainer.offsetHeight; // Force reflow
                canvasContainer.style.display = 'block';
            }
            
            // Force nodes container refresh
            const nodesContainer = document.getElementById('nodes-container');
            if (nodesContainer) {
                nodesContainer.style.display = 'none';
                nodesContainer.offsetHeight; // Force reflow
                nodesContainer.style.display = 'block';
            }
            
            // Force SVG refresh
            const svg = document.getElementById('connections-svg');
            if (svg) {
                svg.style.display = 'none';
                svg.offsetHeight; // Force reflow
                svg.style.display = 'block';
            }
            
            console.log('Visual refresh completed');
        } catch (error) {
            console.error('Error during visual refresh:', error);
        }
    }

    /**
     * Recover UI state after clear operation
     */
    recoverUIState() {
        console.log('Recovering UI state after clear');
        
        // DON'T re-setup handlers - they're still attached!
        // Just reset button states
        
        const startBtn = document.getElementById('start-capture');
        const pauseBtn = document.getElementById('pause-capture');
        const stopBtn = document.getElementById('stop-capture');
        
        // Reset button states
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        
        // Ensure recording state is correct
        this.isRecording = false;
        
        // Update status indicators
        const captureStatus = document.getElementById('capture-status');
        if (captureStatus) {
            const statusText = captureStatus.querySelector('.status-text');
            const statusDot = captureStatus.querySelector('.status-dot');
            if (statusText) statusText.textContent = 'Ready';
            if (statusDot) statusDot.style.background = '#4caf50';
        }
        
        const globalStatus = document.getElementById('global-recording-status');
        if (globalStatus) {
            globalStatus.classList.remove('recording');
            const lastSpan = globalStatus.querySelector('span:last-child');
            if (lastSpan) lastSpan.textContent = 'Ready';
        }
        
        console.log('UI state recovered successfully');
    }
    
    /**
     * Refresh the entire application
     */
    refreshApplication() {
        // Confirm before refreshing
        const confirmed = confirm('Are you sure you want to refresh? Any unsaved data will be lost.');
        
        if (confirmed) {
            // If in Electron, reload the window
            if (window.electronAPI) {
                window.location.reload();
            } else {
                // For browser, just reload
                window.location.reload();
            }
        }
    }

    /**
     * Mark current moment as important (Legacy - being replaced by Mark Before)
     */
    markCurrentAsImportant() {
        // Tell main process we're marking a step FIRST (to prevent recording the action)
        if (window.electronAPI) {
            window.electronAPI.markImportant({});
        }
        
        // Add a delay to ensure the flag is set before dialog shows
        setTimeout(() => {
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
        }, 100); // 100ms delay to ensure flag is set
    }
    
    /**
     * Show intent dialog - NEW: appears IMMEDIATELY on Cmd+Shift+M
     */
    showIntentDialog() {
        // Remove any existing dialog
        const existingDialog = document.querySelector('.intent-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        // Create intent dialog
        const dialog = document.createElement('div');
        dialog.className = 'intent-dialog mark-completed-dialog'; // Reuse existing styles
        dialog.innerHTML = `
            <div class="mark-completed-header">
                <span class="mark-completed-icon">🎯</span>
                <span class="mark-completed-title">What are you about to do?</span>
            </div>
            
            <div class="mark-completed-form">
                <div class="form-group">
                    <label>Describe your intent:</label>
                    <input type="text" id="intent-description" class="form-input" 
                           placeholder="e.g., Create ActiveCampaign automation" autofocus>
                    <small style="color: #666; display: block; margin-top: 5px;">
                        No time limit - capture will continue until you stop it
                    </small>
                </div>
                
                <div class="button-group">
                    <button id="start-capture-btn" class="primary-btn">
                        <span>🔴</span> Start Capture
                    </button>
                    <button id="cancel-intent-btn" class="secondary-btn">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Focus on input
        const intentInput = document.getElementById('intent-description');
        intentInput.focus();
        
        // Handle Enter key
        intentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.startIntentCapture(intentInput.value);
                dialog.remove();
            } else if (e.key === 'Escape') {
                dialog.remove();
            }
        });
        
        // Handle Start button
        document.getElementById('start-capture-btn').addEventListener('click', () => {
            const intent = intentInput.value.trim();
            if (intent) {
                this.startIntentCapture(intent);
                dialog.remove();
            } else {
                intentInput.focus();
                intentInput.style.borderColor = '#ff6b6b';
            }
        });
        
        // Handle Cancel button
        document.getElementById('cancel-intent-btn').addEventListener('click', () => {
            dialog.remove();
        });
    }
    
    /**
     * Start capture with declared intent
     */
    async startIntentCapture(intent) {
        console.log('[App] Starting capture with intent:', intent);
        
        // Show notification
        this.showNotification(`📹 Recording: "${intent}" (30 seconds)`);
        
        // Start mark mode with intent
        if (window.electronAPI) {
            const result = await window.electronAPI.invoke('mark-before:start-with-intent', { intent });
            if (result.success) {
                console.log('[App] Mark Before started successfully');
                
                // Show visual indicator that capture is active
                this.showMarkModeIndicator({ description: intent });
            } else {
                console.error('[App] Failed to start Mark Before:', result.error);
                this.showNotification('Failed to start capture', 'error');
            }
        }
    }
    
    /**
     * Start Mark Before mode - captures next action with intent
     */
    startMarkMode() {
        // Now this shows the intent dialog
        this.showIntentDialog();
    }
    
    /**
     * Show inactivity dialog when no activity detected
     */
    showInactivityDialog(data) {
        // Remove any existing dialog
        const existingDialog = document.querySelector('.inactivity-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        // Create inactivity dialog
        const dialog = document.createElement('div');
        dialog.className = 'inactivity-dialog mark-completed-dialog'; // Reuse existing styles
        dialog.style.zIndex = '10000'; // Ensure it's on top
        
        const minutes = Math.floor(data.duration / 60000);
        const seconds = Math.floor((data.duration % 60000) / 1000);
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        
        dialog.innerHTML = `
            <div class="mark-completed-header" style="background: #ff9800;">
                <span class="mark-completed-icon">⏸️</span>
                <span class="mark-completed-title">Capture Paused - No Activity Detected</span>
            </div>
            
            <div class="mark-completed-form">
                <div style="margin-bottom: 15px; color: #666;">
                    <p>No activity for 30 seconds. What would you like to do?</p>
                    <p style="font-size: 12px; margin-top: 5px;">
                        Captured ${data.eventCount} events over ${timeStr}
                    </p>
                </div>
                
                <div class="inactivity-options" style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="option-btn looking-btn" style="padding: 15px; text-align: left; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; background: white;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 24px; margin-right: 10px;">🔍</span>
                            <div>
                                <strong>I'm looking for something</strong>
                                <div style="font-size: 12px; color: #666;">Pause while I search for information</div>
                            </div>
                        </div>
                    </button>
                    
                    <button class="option-btn continue-btn" style="padding: 15px; text-align: left; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; background: white;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 24px; margin-right: 10px;">▶️</span>
                            <div>
                                <strong>Continue capturing</strong>
                                <div style="font-size: 12px; color: #666;">I was just thinking/reading</div>
                            </div>
                        </div>
                    </button>
                    
                    <button class="option-btn complete-btn" style="padding: 15px; text-align: left; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; background: white;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 24px; margin-right: 10px;">✅</span>
                            <div>
                                <strong>Complete this action</strong>
                                <div style="font-size: 12px; color: #666;">I'm done with this marked action</div>
                            </div>
                        </div>
                    </button>
                </div>
                
                <div id="looking-details" style="display: none; margin-top: 15px;">
                    <label style="display: block; margin-bottom: 5px;">What are you looking for?</label>
                    <input type="text" id="looking-for-input" class="form-input" 
                           placeholder="e.g., Customer ID, login credentials, documentation..."
                           style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px;">
                    <button id="confirm-looking-btn" class="primary-btn" style="margin-top: 10px;">
                        Track Side Quest
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add hover effects
        dialog.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#f5f5f5';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'white';
            });
        });
        
        // Handle looking for something
        const lookingBtn = dialog.querySelector('.looking-btn');
        const lookingDetails = dialog.querySelector('#looking-details');
        const lookingInput = dialog.querySelector('#looking-for-input');
        const confirmLookingBtn = dialog.querySelector('#confirm-looking-btn');
        
        lookingBtn.addEventListener('click', () => {
            // Hide option buttons
            dialog.querySelector('.inactivity-options').style.display = 'none';
            // Show input field
            lookingDetails.style.display = 'block';
            lookingInput.focus();
        });
        
        confirmLookingBtn.addEventListener('click', async () => {
            const lookingFor = lookingInput.value.trim() || 'Required information';
            
            // Send response to main process
            await window.electronAPI.handleInactivityResponse('looking', {
                lookingFor: lookingFor
            });
            
            // Update chat guide
            if (this.chat) {
                this.chat.addMessage('system', `📍 Side Quest: Looking for ${lookingFor}`);
            }
            
            dialog.remove();
        });
        
        // Handle continue capturing
        dialog.querySelector('.continue-btn').addEventListener('click', async () => {
            await window.electronAPI.handleInactivityResponse('continue');
            dialog.remove();
        });
        
        // Handle complete action
        dialog.querySelector('.complete-btn').addEventListener('click', async () => {
            await window.electronAPI.handleInactivityResponse('complete');
            dialog.remove();
        });
        
        // Handle Enter key in input
        lookingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmLookingBtn.click();
            }
        });
    }
    
    /**
     * Update mark mode status indicator
     */
    updateMarkModeStatus(status) {
        const indicator = document.getElementById('mark-mode-indicator');
        if (!indicator) return;
        
        if (status.paused) {
            indicator.style.background = '#ff9800';
            const title = indicator.querySelector('.mark-mode-title');
            if (title) title.textContent = 'PAUSED - Waiting for input';
        } else if (status.sideQuest) {
            indicator.style.background = '#2196F3';
            const title = indicator.querySelector('.mark-mode-title');
            if (title) title.textContent = `SIDE QUEST: ${status.description}`;
        } else {
            indicator.style.background = '#e91e63';
            const title = indicator.querySelector('.mark-mode-title');
            if (title) title.textContent = 'MARK MODE ACTIVE';
        }
    }
    
    /**
     * Show mark mode indicator UI
     */
    showMarkModeIndicator(data) {
        const indicator = document.getElementById('mark-mode-indicator');
        const eventCount = document.getElementById('mark-event-count');
        const textPreview = document.getElementById('mark-text-preview');
        const textContent = document.getElementById('mark-text-content');
        
        // Show the indicator
        indicator.classList.remove('hidden');
        
        // Update event count periodically
        this.markModeInterval = setInterval(async () => {
            if (window.electronAPI) {
                const status = await window.electronAPI.getMarkStatus();
                if (status.active) {
                    eventCount.textContent = status.eventCount;
                    
                    // Show text preview if typing
                    if (status.currentText && status.currentText.length > 0) {
                        textPreview.classList.remove('hidden');
                        textContent.textContent = status.currentText;
                    } else {
                        textPreview.classList.add('hidden');
                    }
                }
            }
        }, 100);
        
        // Handle Done button
        const doneBtn = document.getElementById('done-mark');
        doneBtn.onclick = () => {
            console.log('Done button clicked');
            if (window.electronAPI) {
                window.electronAPI.markImportant({ action: 'stop', reason: 'done-button' });
            }
        };
        
        // Handle cancel button
        const cancelBtn = document.getElementById('cancel-mark');
        cancelBtn.onclick = () => {
            console.log('Cancel button clicked');
            if (window.electronAPI) {
                window.electronAPI.markImportant({ action: 'stop', reason: 'cancelled' });
            }
            this.hideMarkModeIndicator();
        };
    }
    
    /**
     * Hide mark mode indicator
     */
    hideMarkModeIndicator() {
        const indicator = document.getElementById('mark-mode-indicator');
        indicator.classList.add('hidden');
        
        // Clear the update interval
        if (this.markModeInterval) {
            clearInterval(this.markModeInterval);
            this.markModeInterval = null;
        }
    }
    
    /**
     * Handle mark completed event
     */
    handleMarkCompleted(data) {
        console.log('=================================');
        console.log('[Mark] MARK COMPLETED HANDLER CALLED');
        console.log('[Mark] Data received:', data);
        console.log('[Mark] Events count:', data?.events?.length);
        console.log('[Mark] Captured text:', data?.capturedText);
        console.log('[Mark] Summary:', data?.summary);
        console.log('=================================');
        
        // Hide the indicator
        this.hideMarkModeIndicator();
        
        // Don't save yet - wait for user to confirm in dialog
        // Just show the dialog for now
        console.log('[Mark] Calling showMarkCompletedDialog...');
        this.showMarkCompletedDialog(data);
        console.log('[Mark] Dialog should be visible now');
    }
    
    /**
     * Show mark completed dialog with context capture
     */
    showMarkCompletedDialog(data) {
        // Remove any existing dialog first
        const existingDialog = document.querySelector('.mark-completed-dialog');
        if (existingDialog) {
            console.log('[Dialog] Removing existing dialog first');
            existingDialog.remove();
        }
        
        // Create dialog element
        const dialog = document.createElement('div');
        dialog.className = 'mark-completed-dialog';
        dialog.id = 'mark-completed-dialog-' + Date.now(); // Unique ID
        dialog.innerHTML = `
            <div class="mark-completed-header">
                <span class="mark-completed-icon">✅</span>
                <span class="mark-completed-title">Step Captured Successfully!</span>
            </div>
            
            <div class="mark-completed-form">
                <div class="form-group">
                    <label>What did you just do?</label>
                    <input type="text" id="mark-description" class="form-input" 
                           value="${data.summary}" placeholder="e.g., Searched for customer">
                </div>
                
                <div class="form-group">
                    <label>Why did you do this? (Context)</label>
                    <textarea id="mark-context" class="form-input" rows="2" 
                              placeholder="e.g., Need to verify customer details before processing order"></textarea>
                </div>
                
                <div class="mark-completed-details">
                    <span class="detail-item">📊 ${data.events.length} events captured</span>
                    <span class="detail-item">⏱️ ${(data.duration / 1000).toFixed(1)}s duration</span>
                    ${data.capturedText ? `<span class="detail-item">💬 Text: "${data.capturedText}"</span>` : ''}
                </div>
            </div>
            
            <div class="mark-completed-actions">
                <button class="btn btn-success" id="save-mark">💾 Save Step</button>
                <button class="btn" id="discard-mark">Discard</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        console.log('[Dialog] Mark dialog added to DOM');
        
        // Focus on description field
        setTimeout(() => {
            const descField = document.getElementById('mark-description');
            if (descField) {
                descField.focus();
                console.log('[Dialog] Description field focused');
            } else {
                console.error('[Dialog] Description field not found!');
            }
        }, 100);
        
        // Wait a moment to ensure DOM is ready
        setTimeout(() => {
            // Handle Save button
            const saveBtn = document.getElementById('save-mark');
            const discardBtn = document.getElementById('discard-mark');
            
            console.log('[Dialog] Looking for buttons...');
            console.log('[Dialog] Save button found:', !!saveBtn);
            console.log('[Dialog] Discard button found:', !!discardBtn);
            
            if (!saveBtn) {
                console.error('[Dialog] ERROR: Save button not found in DOM!');
                // Try to find by class as backup
                const buttons = dialog.querySelectorAll('button');
                console.log('[Dialog] Found buttons in dialog:', buttons.length);
                buttons.forEach((btn, i) => {
                    console.log(`[Dialog] Button ${i}: "${btn.textContent.trim()}", id="${btn.id}"`);
                });
            }
            
            if (saveBtn) {
                console.log('[Dialog] Attaching Save button handler...');
                
                // Try both onclick and addEventListener for maximum compatibility
                saveBtn.addEventListener('click', (e) => {
                    console.log('>>> SAVE BUTTON CLICKED (addEventListener)! <<<');
                    e.stopPropagation();
                    
                    // Prevent duplicate saves
                    if (this.isSavingMark) {
                        console.log('[Dialog] Already saving, ignoring duplicate click');
                        return;
                    }
                    this.isSavingMark = true;
            
            try {
                const description = document.getElementById('mark-description').value || data.summary;
                const context = document.getElementById('mark-context').value;
                
                console.log('Saving with description:', description, 'context:', context);
                
                // Update the data with user input
                data.summary = description;
                data.context = context;
                
                // Add to activity tracker first
                if (this.tracker && this.isRecording) {
                    this.tracker.addActivity({
                        type: 'marked-action',
                        summary: description,
                        capturedText: data.capturedText,
                        actionType: data.actionType,
                        timestamp: data.startTime,
                        duration: data.duration,
                        eventCount: data.events.length,
                        context: context,
                        application: data.events[0]?.application || 'Unknown'
                    });
                }
                
                // Save to process engine with context - always save even if not recording
                // so marked steps are preserved
                // Extract element data from events for proper storage
                const enrichedEvents = data.events.map(event => {
                    if (event.element && event.pageContext) {
                        // Full browser context captured
                        return {
                            ...event,
                            hasFullContext: true
                        };
                    }
                    return event;
                });
                
                const nodeData = {
                    type: 'marked-action',
                    description: description,
                    context: context,
                    timestamp: data.startTime,
                    duration: data.duration,
                    data: {
                        capturedText: data.capturedText,
                        actionType: data.actionType,
                        events: enrichedEvents,
                        reason: context,
                        // Store primary element if it's a click with element data
                        primaryElement: enrichedEvents.find(e => e.type === 'click' && e.element)?.element,
                        primaryPageContext: enrichedEvents.find(e => e.type === 'click' && e.pageContext)?.pageContext
                    }
                };
                
                const nodeId = this.engine.addNode(nodeData);
                if (nodeId) {
                    this.engine.markNodeAsImportant(nodeId);
                    console.log('Added node to engine:', nodeId);
                } else {
                    console.error('Failed to add node to engine');
                }
                
                // Add to chat with context
                this.addChatMessage('ai', `✅ Saved: "${description}"${context ? ` (${context})` : ''}`);
                
                // Show success notification
                this.showSuccessNotification(`Step saved: ${description}`);
                
                // Remove dialog
                console.log('Removing dialog from DOM...');
                if (document.body.contains(dialog)) {
                    document.body.removeChild(dialog);
                    console.log('Dialog removed successfully');
                } else {
                    console.log('Dialog not found in body');
                }
                
                // Reset flag after successful save
                this.isSavingMark = false;
                    } catch (error) {
                        console.error('ERROR in save handler:', error);
                        alert('Error saving step: ' + error.message);
                        // Reset flag on error too
                        this.isSavingMark = false;
                    }
                });
                console.log('[Dialog] Save button handler attached successfully');
            } else {
                console.error('[Dialog] Cannot attach Save handler - button not found!');
            }
            
            // Handle Discard button
            if (discardBtn) {
                console.log('[Dialog] Attaching Discard button handler...');
                discardBtn.addEventListener('click', (e) => {
                    console.log('>>> DISCARD BUTTON CLICKED (addEventListener)! <<<');
                    e.stopPropagation();
                    try {
                        if (document.body.contains(dialog)) {
                            document.body.removeChild(dialog);
                            console.log('[Dialog] Dialog removed after discard');
                        }
                        this.addChatMessage('ai', `❌ Discarded captured action`);
                    } catch (error) {
                        console.error('ERROR in discard handler:', error);
                    }
                });
                console.log('[Dialog] Discard button handler attached successfully');
            } else {
                console.error('[Dialog] Cannot attach Discard handler - button not found!');
            }
            
            // Handle Enter key in form
            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const saveBtn = document.getElementById('save-mark');
                    if (saveBtn) {
                        console.log('[Dialog] Enter key pressed, triggering save...');
                        saveBtn.click();
                    }
                }
            });
        }, 150); // End of setTimeout for button handlers
        
        // Alternative: Use event delegation as fallback
        dialog.addEventListener('click', (e) => {
            const target = e.target;
            console.log('[Dialog] Click event on:', target.tagName, target.id, target.textContent);
            
            // Check if Save button was clicked
            if (target.id === 'save-mark' || target.textContent.includes('Save Step')) {
                console.log('[Dialog-Delegation] SAVE CLICKED via delegation!');
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent duplicate saves
                if (this.isSavingMark) {
                    console.log('[Dialog-Delegation] Already saving, ignoring duplicate');
                    return;
                }
                this.isSavingMark = true;
                
                try {
                    const description = document.getElementById('mark-description').value || data.summary;
                    const context = document.getElementById('mark-context').value;
                    
                    console.log('[Dialog-Delegation] Saving with:', { description, context });
                    
                    // Save to engine
                    const nodeData = {
                        type: 'marked-action',
                        description: description,
                        context: context,
                        timestamp: data.startTime,
                        duration: data.duration,
                        data: {
                            capturedText: data.capturedText,
                            actionType: data.actionType,
                            events: data.events,
                            reason: context
                        }
                    };
                    
                    const nodeId = this.engine.addNode(nodeData);
                    if (nodeId) {
                        this.engine.markNodeAsImportant(nodeId);
                        console.log('[Dialog-Delegation] Node added:', nodeId);
                    }
                    
                    this.addChatMessage('ai', `✅ Saved: "${description}"${context ? ` (${context})` : ''}`);
                    this.showSuccessNotification(`Step saved: ${description}`);
                    
                    // Remove dialog
                    dialog.remove();
                    console.log('[Dialog-Delegation] Dialog removed');
                    
                    // Reset flag after successful save
                    this.isSavingMark = false;
                } catch (error) {
                    console.error('[Dialog-Delegation] Error:', error);
                    alert('Error: ' + error.message);
                    // Reset flag on error too
                    this.isSavingMark = false;
                }
            }
            
            // Check if Discard button was clicked
            if (target.id === 'discard-mark' || target.textContent === 'Discard') {
                console.log('[Dialog-Delegation] DISCARD CLICKED via delegation!');
                e.preventDefault();
                e.stopPropagation();
                dialog.remove();
                this.addChatMessage('ai', `❌ Discarded captured action`);
            }
        });
    }

    /**
     * Show success notification
     */
    showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.innerHTML = `
            <span class="success-icon">✅</span>
            <span class="success-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
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
            id: generateUUID(),
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
                    id: generateUUID(),
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
        console.log(`📤 Export: Starting export in ${format} format`);
        
        // Check if we have data to export
        if (!this.engine || this.engine.process.nodes.size === 0) {
            console.warn('⚠️ Export: No data to export');
            this.showNotification('No data to export. Capture some steps first!', 'warning');
            const preview = document.getElementById('export-preview');
            preview.value = 'No data captured yet. Start capturing to export.';
            return;
        }
        
        console.log(`📊 Export: Found ${this.engine.process.nodes.size} nodes to export`);
        
        // Get export data
        const exportData = this.engine.exportForAutomation(format);
        console.log(`📤 Export: Generated export data, length: ${exportData ? exportData.length : 0}`);
        
        const preview = document.getElementById('export-preview');
        
        if (!exportData || exportData.trim() === '') {
            console.error('❌ Export: Export data is empty!');
            preview.value = 'Error: Export generated empty data. Please check the console.';
            return;
        }
        
        preview.value = exportData;
        console.log('✅ Export: Data displayed in preview');
        
        // Update selected button
        document.querySelectorAll('.export-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
    }

    /**
     * Download export file
     */
    downloadExport() {
        console.log('💾 Download: Starting download...');
        
        const preview = document.getElementById('export-preview');
        const format = document.querySelector('.export-option.selected')?.dataset.format || 'json';
        
        console.log(`💾 Download: Format: ${format}`);
        console.log(`💾 Download: Content length: ${preview.value.length}`);
        
        // Check if there's content to download
        if (!preview.value || preview.value.trim() === '' || 
            preview.value.includes('No data captured') || 
            preview.value.includes('Error:')) {
            console.error('❌ Download: No valid content to download');
            this.showNotification('No valid data to download', 'error');
            return;
        }
        
        const extensions = {
            'json': 'json',
            'yaml': 'yaml',
            'mermaid': 'md',
            'playwright': 'js',
            'python': 'py',
            'documentation': 'md'
        };
        
        // Create proper MIME types
        const mimeTypes = {
            'json': 'application/json',
            'yaml': 'text/yaml',
            'mermaid': 'text/markdown',
            'playwright': 'text/javascript',
            'python': 'text/x-python',
            'documentation': 'text/markdown'
        };
        
        const mimeType = mimeTypes[format] || 'text/plain';
        const extension = extensions[format] || 'txt';
        const filename = `process-capture-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${extension}`;
        
        console.log(`💾 Download: Creating file: ${filename}`);
        
        const blob = new Blob([preview.value], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a); // Required for Firefox
        a.click();
        document.body.removeChild(a); // Clean up
        URL.revokeObjectURL(url);
        
        console.log('✅ Download: File download initiated');
        this.showNotification(`Downloaded: ${filename}`, 'success');
    }

    /**
     * Handle engine events
     */
    handleEngineEvent(event, data) {
        switch (event) {
            case 'nodeCreated':
                // Canvas is updated separately
                // Update save indicator
                this.updateSaveIndicator(true);
                break;
            case 'nodeUpdated':
                // Update canvas node if method exists
                if (this.canvas && this.canvas.updateNode) {
                    this.canvas.updateNode(data);
                } else {
                    console.log('[Engine] Canvas updateNode not available, skipping visual update');
                }
                // Update save indicator
                this.updateSaveIndicator(true);
                break;
            case 'edgeAdded':
                // Canvas handles this
                // Update save indicator
                this.updateSaveIndicator(true);
                break;
            case 'process:saved':
                // Update save indicator when saved
                this.updateSaveIndicator(false);
                break;
            case 'process:cleared':
                // Update save indicator when cleared
                this.updateSaveIndicator(false);
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
            - Ctrl+S: Save process
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
    showNotification(message, type = 'success') {
        // Enhanced notification with different types
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Different colors for different types
        const colors = {
            'success': '#4CAF50',
            'error': '#f44336',
            'warning': '#ff9800',
            'info': '#2196F3'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.success};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            animation: slideIn 0.3s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
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
        console.log('📂 LoadSession: Checking for saved session...');
        
        // Check localStorage first
        const savedData = localStorage.getItem('process_capture_data');
        if (savedData) {
            const dataSize = (savedData.length / 1024).toFixed(2);
            console.log(`📂 LoadSession: Found saved data (${dataSize}KB) in localStorage`);
        } else {
            console.log('📂 LoadSession: No saved data found in localStorage');
        }
        
        // Session is auto-loaded by ProcessEngine
        // Rebuild canvas from saved data
        if (this.engine.process.nodes.size > 0) {
            console.log(`📂 LoadSession: Loading ${this.engine.process.nodes.size} nodes to canvas...`);
            
            for (const [nodeId, node] of this.engine.process.nodes) {
                this.canvas.addNode(node);
            }
            
            console.log(`📂 LoadSession: Drawing ${this.engine.process.edges.length} connections...`);
            for (const edge of this.engine.process.edges) {
                this.canvas.drawConnection(edge.from, edge.to, edge.type, edge.label);
            }
            
            console.log('✅ LoadSession: Session restored successfully');
            this.addChatMessage('ai', `Loaded previous session with ${this.engine.process.nodes.size} steps.`);
        } else {
            console.log('📂 LoadSession: No nodes to load, starting fresh');
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

    /**
     * Check browser connection status
     */
    async checkBrowserStatus() {
        if (!window.electronAPI) return;
        
        try {
            const status = await window.electronAPI.getBrowserStatus();
            this.updateBrowserStatus(status);
        } catch (error) {
            console.error('Error checking browser status:', error);
            this.updateBrowserStatus({ connected: false, message: 'Error checking status' });
        }
    }
    
    /**
     * Update browser status display
     */
    updateBrowserStatus(status) {
        if (this.elements.browserStatus) {
            if (status.connected) {
                this.elements.browserStatus.textContent = '🟢 Browser: Enhanced Capture Active';
                this.elements.browserStatus.style.color = '#28a745';
            } else {
                this.elements.browserStatus.textContent = '🔴 Browser: Basic Capture Only';
                this.elements.browserStatus.style.color = '#dc3545';
            }
        }
    }
    
    /**
     * Test the clear functionality
     */
    testClearFunctionality() {
        console.log('Testing clear functionality...');
        
        // Add a test node to the canvas
        if (this.canvas) {
            const testNode = {
                id: 'test-node-' + Date.now(),
                type: 'action',
                title: 'Test Node',
                step: 1
            };
            
            this.canvas.addNode(testNode);
            console.log('Added test node');
            
            // Wait a moment, then clear
            setTimeout(() => {
                console.log('Clearing test node...');
                this.canvas.clear();
                
                // Check if clear worked
                setTimeout(() => {
                    const nodesContainer = document.getElementById('nodes-container');
                    const svg = document.getElementById('connections-svg');
                    
                    console.log('Clear test results:');
                    console.log('- Nodes container children:', nodesContainer?.children?.length || 0);
                    console.log('- SVG children (excluding defs):', 
                        svg ? Array.from(svg.children).filter(child => child.tagName !== 'defs').length : 0);
                    console.log('- Canvas nodes map size:', this.canvas.nodes.size);
                    console.log('- Canvas connections map size:', this.canvas.connections.size);
                    
                    if (this.canvas.nodes.size === 0 && this.canvas.connections.size === 0) {
                        console.log('✅ Clear test PASSED');
                    } else {
                        console.log('❌ Clear test FAILED');
                    }
                }, 100);
            }, 500);
        } else {
            console.error('Canvas not available for testing');
        }
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