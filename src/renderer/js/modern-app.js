/**
 * Modern Process Capture Studio - Main Application Controller
 * VS Code-inspired interface with vertical sidebar navigation
 */

// Fallback UUID generator if crypto.randomUUID is not available
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class ModernProcessCaptureApp {
    constructor() {
        try {
            // Wait for ProcessEngine to be available or create it
            if (typeof ProcessEngine !== 'undefined') {
                this.engine = new ProcessEngine();
                console.log('ProcessEngine initialized');
            } else {
                console.warn('ProcessEngine not loaded, some features may be unavailable');
                this.engine = null;
            }
            
            // Wait for CanvasBuilder to be available
            if (typeof CanvasBuilder !== 'undefined') {
                this.canvasBuilder = new CanvasBuilder();
                // Check if canvas builder initialized properly
                if (this.canvasBuilder && this.canvasBuilder.nodesContainer) {
                    window.canvasBuilder = this.canvasBuilder; // Make globally available
                    console.log('CanvasBuilder initialized successfully');
                } else {
                    console.warn('CanvasBuilder failed to initialize properly');
                    this.canvasBuilder = null;
                }
            } else {
                console.warn('CanvasBuilder not loaded, canvas features unavailable');
                this.canvasBuilder = null;
            }
            
            this.isCapturing = false;
            this.currentView = 'process-map';
            this.sidebarExpanded = true;
            this.theme = 'dark';
            
            // Step tracking
            this.isStepActive = false;
            this.currentStepId = null;
            this.stepStartTime = null;
            
            // Terminal mode
            this.terminalMode = localStorage.getItem('terminalMode') === 'true';
            
            this.initialize();
        } catch (error) {
            console.error('Error in ModernProcessCaptureApp constructor:', error);
            // Try to continue with partial functionality
            this.engine = null;
            this.canvasBuilder = null;
            this.initialize();
        }
    }
    
    initialize() {
        try { this.setupActivityBar(); } catch (e) { console.error('Error setting up activity bar:', e); }
        try { this.setupSidebar(); } catch (e) { console.error('Error setting up sidebar:', e); }
        try { this.setupFloatingActions(); } catch (e) { console.error('Error setting up floating actions:', e); }
        try { this.setupKeyboardShortcuts(); } catch (e) { console.error('Error setting up keyboard shortcuts:', e); }
        try { this.setupElectronListeners(); } catch (e) { console.error('Error setting up electron listeners:', e); }
        try { this.setupExportDialog(); } catch (e) { console.error('Error setting up export dialog:', e); }
        try { this.setupTheme(); } catch (e) { console.error('Error setting up theme:', e); }
        try { this.setupWindowControls(); } catch (e) { console.error('Error setting up window controls:', e); }
        try { this.setupTerminalMode(); } catch (e) { console.error('Error setting up terminal mode:', e); }
        try { this.setupBrowserControls(); } catch (e) { console.error('Error setting up browser controls:', e); }
        
        // Initialize with process map view
        try { this.switchView('process-map'); } catch (e) { console.error('Error switching view:', e); }
        
        // Load saved process data
        try { this.loadSavedProcess(); } catch (e) { console.error('Error loading saved process:', e); }
        
        console.log('Modern Process Capture Studio initialized');
    }
    
    /**
     * Load saved process data from localStorage
     */
    loadSavedProcess() {
        if (this.engine) {
            // ProcessEngine loads from localStorage automatically in initializeStorage()
            // which is called in its constructor, so we just need to rebuild the canvas
            
            // Rebuild canvas from saved nodes
            if (this.canvasBuilder && this.engine.process) {
                const nodes = Array.from(this.engine.process.nodes.values());
                console.log(`Loading ${nodes.length} saved nodes to canvas...`);
                nodes.forEach(node => {
                    this.canvasBuilder.addNode(node);
                });
                
                // Update stats
                this.updateProcessStats();
                
                // Update session status if a session was saved
                if (this.engine.process.sessionState) {
                    this.updateSessionStatus(true, this.engine.process.sessionState);
                    console.log('Restored saved session state');
                }
            }
        }
    }
    
    /**
     * Setup activity bar navigation
     */
    setupActivityBar() {
        const activityItems = document.querySelectorAll('.activity-item');
        
        activityItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            });
        });
    }
    
    /**
     * Switch between different views
     */
    switchView(view) {
        // Update activity bar
        document.querySelectorAll('.activity-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
        
        // Update sidebar content
        document.querySelectorAll('.sidebar-view').forEach(v => {
            v.classList.toggle('active', v.id === `sidebar-${view}`);
        });
        
        // Update sidebar title
        const titles = {
            'process-map': 'Process Map',
            'live-activity': 'Live Activity',
            'process-guide': 'Process Guide',
            'settings': 'Settings'
        };
        
        const sidebarTitle = document.getElementById('sidebar-title');
        if (sidebarTitle) {
            sidebarTitle.textContent = titles[view] || 'Process Capture';
        }
        
        this.currentView = view;
        
        // Show/hide step controls based on view
        if (view === 'live-activity' && this.isCapturing) {
            document.getElementById('step-controls')?.classList.remove('hidden');
        }
    }
    
    /**
     * Setup sidebar interactions
     */
    setupSidebar() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        
        sidebarToggle?.addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Quick actions
        document.getElementById('capture-session')?.addEventListener('click', () => {
            this.captureSession();
        });
        
        document.getElementById('export-process')?.addEventListener('click', () => {
            this.showExportDialog();
        });
        
        document.getElementById('save-process-quick')?.addEventListener('click', () => {
            this.saveProcess();
        });
        
        document.getElementById('clear-all')?.addEventListener('click', () => {
            this.clearAllData();
        });
        
        // Activity filters
        this.activityFilters = {
            clicks: true,
            keys: true,
            nav: true
        };
        
        document.getElementById('filter-clicks')?.addEventListener('change', (e) => {
            this.activityFilters.clicks = e.target.checked;
        });
        
        document.getElementById('filter-keys')?.addEventListener('change', (e) => {
            this.activityFilters.keys = e.target.checked;
        });
        
        document.getElementById('filter-nav')?.addEventListener('change', (e) => {
            this.activityFilters.nav = e.target.checked;
        });
        
        // Settings
        document.getElementById('theme-select')?.addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });
        
        document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
            this.setOpacity(e.target.value);
        });
        
        document.getElementById('always-on-top')?.addEventListener('change', (e) => {
            this.setAlwaysOnTop(e.target.checked);
        });
    }
    
    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
        
        if (isCollapsed) {
            sidebar.classList.remove('sidebar-collapsed');
            this.sidebarExpanded = true;
        } else {
            sidebar.classList.add('sidebar-collapsed');
            this.sidebarExpanded = false;
        }
        
        // Save preference
        localStorage.setItem('sidebarExpanded', this.sidebarExpanded);
        
        // Trigger canvas resize if needed
        if (this.canvasBuilder?.resizeCanvas) {
            setTimeout(() => {
                this.canvasBuilder.resizeCanvas();
            }, 300);
        }
    }
    
    /**
     * Setup floating action buttons
     */
    setupFloatingActions() {
        const startCaptureFab = document.getElementById('start-capture-fab');
        const startStepBtn = document.getElementById('start-step');
        const endStepBtn = document.getElementById('end-step');
        const stepControls = document.getElementById('step-controls');
        
        // Also hook up the sidebar step buttons
        const sidebarStartStep = document.getElementById('step-start-btn');
        const sidebarEndStep = document.getElementById('step-end-btn');
        
        startCaptureFab?.addEventListener('click', () => {
            this.toggleCapture();
        });
        
        // Floating step buttons
        startStepBtn?.addEventListener('click', () => {
            this.startNewStep();
        });
        
        endStepBtn?.addEventListener('click', () => {
            this.endCurrentStep();
        });
        
        // Sidebar step buttons
        sidebarStartStep?.addEventListener('click', () => {
            this.startNewStep();
        });
        
        sidebarEndStep?.addEventListener('click', () => {
            this.endCurrentStep();
        });
    }
    
    /**
     * Toggle capture state
     */
    async toggleCapture() {
        const fab = document.getElementById('start-capture-fab');
        const stepControls = document.getElementById('step-controls');
        const captureStatus = document.querySelector('.capture-status');
        
        if (!this.isCapturing) {
            // Start capture
            if (window.electronAPI) {
                // Note: startCapture doesn't return a promise, it sends a message
                window.electronAPI.startCapture();
                
                // Update UI immediately
                this.isCapturing = true;
                fab.classList.add('recording');
                fab.querySelector('span').textContent = 'Stop Capture';
                stepControls?.classList.remove('hidden');
                captureStatus?.classList.add('recording');
                
                // Switch to live activity view
                this.switchView('live-activity');
                
                // Show step controls
                document.getElementById('step-boundary-controls')?.classList.remove('hidden');
                
                this.showToast('Capture started', 'success');
            }
        } else {
            // Stop capture
            if (window.electronAPI) {
                // Note: stopCapture doesn't return a promise, it sends a message
                window.electronAPI.stopCapture();
                
                // Update UI immediately
                this.isCapturing = false;
                fab.classList.remove('recording');
                fab.querySelector('span').textContent = 'Start Capture';
                stepControls?.classList.add('hidden');
                captureStatus?.classList.remove('recording');
                this.showToast('Capture stopped', 'info');
            }
        }
    }
    
    /**
     * Start a new step
     */
    async startNewStep() {
        // Create a custom dialog instead of using prompt()
        const name = await this.showStepNameDialog();
        if (!name) return;
        
        if (window.electronAPI) {
            const result = await window.electronAPI.startStep({ name });
            if (result.success) {
                this.isStepActive = true;
                this.currentStepId = result.stepId;
                this.stepStartTime = Date.now();
                
                // Update UI
                document.getElementById('start-step')?.classList.add('hidden');
                document.getElementById('end-step')?.classList.remove('hidden');
                
                // Update sidebar step buttons
                document.getElementById('step-start-btn')?.classList.add('hidden');
                document.getElementById('step-end-btn')?.classList.remove('hidden');
                
                // Show step progress
                const stepProgress = document.getElementById('step-in-progress');
                if (stepProgress) {
                    stepProgress.classList.remove('hidden');
                    document.getElementById('current-step-name').textContent = name;
                    document.getElementById('step-event-count').textContent = '0';
                    document.getElementById('step-duration').textContent = '0s';
                }
                
                document.getElementById('current-step-status').textContent = '🔴 Recording step...';
                
                this.showToast(`Step started: ${name}`, 'success');
            }
        }
    }
    
    /**
     * Show step name dialog
     */
    async showStepNameDialog() {
        return new Promise((resolve) => {
            // Create a simple inline dialog
            const dialog = document.createElement('div');
            dialog.className = 'modal';
            dialog.innerHTML = `
                <div class="modal-content" style="width: 400px;">
                    <div class="modal-header">
                        <h3>Start New Step</h3>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="step-name-input" 
                               placeholder="What are you about to do?" 
                               style="width: 100%; padding: 8px; background: var(--bg-primary); 
                                      border: 1px solid var(--border-primary); 
                                      border-radius: 4px; color: var(--text-primary);">
                    </div>
                    <div class="modal-footer">
                        <button id="step-name-ok" class="btn-primary">OK</button>
                        <button id="step-name-cancel" class="btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            const input = dialog.querySelector('#step-name-input');
            const okBtn = dialog.querySelector('#step-name-ok');
            const cancelBtn = dialog.querySelector('#step-name-cancel');
            
            // Focus input
            input.focus();
            
            const submit = () => {
                const value = input.value.trim();
                document.body.removeChild(dialog);
                resolve(value || null);
            };
            
            const cancel = () => {
                document.body.removeChild(dialog);
                resolve(null);
            };
            
            okBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', cancel);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') cancel();
            });
        });
    }
    
    /**
     * End current step
     */
    async endCurrentStep() {
        if (!this.isStepActive) return;
        
        if (window.electronAPI) {
            const result = await window.electronAPI.endStep();
            if (result.success) {
                this.isStepActive = false;
                this.currentStepId = null;
                
                // Update UI
                document.getElementById('start-step')?.classList.remove('hidden');
                document.getElementById('end-step')?.classList.add('hidden');
                
                // Update sidebar step buttons
                document.getElementById('step-start-btn')?.classList.remove('hidden');
                document.getElementById('step-end-btn')?.classList.add('hidden');
                
                // Hide step progress
                document.getElementById('step-in-progress')?.classList.add('hidden');
                document.getElementById('current-step-status').textContent = '📝 Ready to start a step';
                
                // Don't add node here - it will be added via the onStepCompleted event
                // This prevents duplicates
                
                this.showToast('Step completed', 'success');
            }
        }
    }
    
    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + number for view switching
            if (e.metaKey || e.ctrlKey) {
                switch(e.key) {
                    case '1':
                        e.preventDefault();
                        this.switchView('process-map');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchView('live-activity');
                        break;
                    case '3':
                        e.preventDefault();
                        this.switchView('process-guide');
                        break;
                    case ',':
                        e.preventDefault();
                        this.switchView('settings');
                        break;
                    case 'b':
                        e.preventDefault();
                        this.toggleSidebar();
                        break;
                    case 's':
                        if (this.isStepActive) {
                            e.preventDefault();
                            this.startNewStep();
                        }
                        break;
                    case 'e':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.showExportDialog();
                        } else if (this.isStepActive) {
                            e.preventDefault();
                            this.endCurrentStep();
                        }
                        break;
                }
            }
            
            // F5 to start/stop capture
            if (e.key === 'F5') {
                e.preventDefault();
                this.toggleCapture();
            }
        });
    }
    
    /**
     * Setup Electron IPC listeners
     */
    setupElectronListeners() {
        if (!window.electronAPI) return;
        
        // Browser status updates - use the correct method name
        if (window.electronAPI.onBrowserStatusUpdate) {
            window.electronAPI.onBrowserStatusUpdate((status) => {
                const statusDot = document.getElementById('browser-status-dot');
                const statusText = document.getElementById('browser-status-text');
                const launchBtn = document.getElementById('launch-browser-btn');
                
                if (statusDot && statusText) {
                    statusDot.style.background = status.connected ? 'var(--color-success)' : 'var(--text-disabled)';
                    statusText.textContent = status.message || 'Not Connected';
                }
                
                if (launchBtn) {
                    if (status.connected) {
                        launchBtn.disabled = false;
                        launchBtn.querySelector('span').textContent = '✅ Browser Connected';
                    } else {
                        launchBtn.disabled = false;
                        launchBtn.querySelector('span').textContent = '🌐 Launch Capture Browser';
                    }
                }
            });
        }
        
        // Capture activity
        if (window.electronAPI.onCaptureActivity) {
            window.electronAPI.onCaptureActivity((activity) => {
                this.addActivityItem(activity);
                
                // Update step event count if step is active
                if (this.isStepActive) {
                    const countEl = document.getElementById('step-event-count');
                    if (countEl) {
                        const currentCount = parseInt(countEl.textContent) || 0;
                        countEl.textContent = currentCount + 1;
                    }
                    
                    // Update duration
                    const durationEl = document.getElementById('step-duration');
                    if (durationEl && this.stepStartTime) {
                        const duration = Math.floor((Date.now() - this.stepStartTime) / 1000);
                        durationEl.textContent = `${duration}s`;
                    }
                }
            });
        }
        
        // Step events
        if (window.electronAPI.onStepStarted) {
            window.electronAPI.onStepStarted((data) => {
                console.log('Step started:', data);
            });
        }
        
        if (window.electronAPI.onStepCompleted) {
            window.electronAPI.onStepCompleted((data) => {
                console.log('Step completed:', data);
                this.handleStepCompleted(data);
            });
        }
    }
    
    /**
     * Add activity item to feed
     */
    addActivityItem(activity) {
        const feed = document.getElementById('activity-feed');
        if (!feed) return;
        
        // Check filters
        if (!this.activityFilters) {
            this.activityFilters = { clicks: true, keys: true, nav: true };
        }
        
        const shouldShow = (
            (activity.type === 'click' && this.activityFilters.clicks) ||
            ((activity.type === 'keystroke' || activity.type === 'keydown' || activity.type === 'typed_text') && this.activityFilters.keys) ||
            (activity.type === 'navigation' && this.activityFilters.nav) ||
            (activity.type === 'step' || activity.type === 'marked-action')
        );
        
        if (!shouldShow) return;
        
        // Get icon based on activity type
        const getActivityIcon = (type) => {
            const icons = {
                'click': '🖱️',
                'keydown': '⌨️',
                'keystroke': '⌨️',
                'typed_text': '💬',
                'scroll': '📜',
                'navigation': '🌐',
                'step': '📍',
                'marked-action': '🎯'
            };
            return icons[type] || '•';
        };
        
        // Format the description
        let description = activity.description || '';
        if (!description) {
            if (activity.type === 'click') {
                description = `Clicked at (${activity.position?.x || activity.x}, ${activity.position?.y || activity.y})`;
            } else if (activity.type === 'typed_text' || activity.type === 'keystroke') {
                // Sanitize keystroke data
                let keyText = activity.text || activity.keys || 'Text input';
                
                // Clean up control characters and escape sequences
                keyText = keyText
                    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
                    .replace(/\\[rntvbf]/g, ' ')     // Replace escape sequences with space
                    .replace(/\s+/g, ' ')             // Collapse multiple spaces
                    .trim();
                
                // Handle special keys
                if (activity.key) {
                    const specialKeys = {
                        'Enter': '↵ Enter',
                        'Tab': '→ Tab',
                        'Escape': 'Esc',
                        'Backspace': '← Backspace',
                        'Delete': 'Del',
                        'ArrowUp': '↑',
                        'ArrowDown': '↓',
                        'ArrowLeft': '←',
                        'ArrowRight': '→',
                        'Shift': '⇧ Shift',
                        'Control': 'Ctrl',
                        'Alt': 'Alt',
                        'Meta': 'Cmd',
                        'CapsLock': 'Caps Lock',
                        'Space': 'Space'
                    };
                    description = specialKeys[activity.key] || activity.key;
                } else if (keyText) {
                    description = keyText || 'Key pressed';
                } else {
                    description = 'Key input';
                }
            } else {
                description = 'Action captured';
            }
        }
        
        // Truncate long descriptions
        if (description.length > 100) {
            description = description.substring(0, 97) + '...';
        }
        
        // Escape HTML entities
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        // Check if terminal mode is active
        const isTerminalMode = feed.classList.contains('terminal-mode');
        
        if (isTerminalMode) {
            // Terminal mode: single line format with full details
            const time = new Date(activity.timestamp).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            // Build terminal line with all relevant data
            let terminalLine = `[${time}] `;
            
            // Add type prefix with color coding
            const typePrefix = document.createElement('span');
            if (activity.type === 'click') {
                typePrefix.textContent = '[Click]';
                typePrefix.style.color = '#4fc3f7';
            } else if (activity.type === 'keystroke' || activity.type === 'typed_text') {
                typePrefix.textContent = '[Type]';
                typePrefix.style.color = '#81c784';
            } else if (activity.type === 'navigation') {
                typePrefix.textContent = '[Nav]';
                typePrefix.style.color = '#ff8a65';
            } else {
                typePrefix.textContent = `[${activity.type}]`;
                typePrefix.style.color = '#ba68c8';
            }
            
            // Build the rest of the line
            let dataLine = ' ';
            
            // Add selector if available (critical for automation)
            const selector = activity.selector || activity.element?.selector || 
                           activity.element?.selectors?.css;
            if (selector) {
                dataLine += `sel:"${selector}" `;
            }
            
            // Add coordinates for clicks
            if (activity.type === 'click' && (activity.x || activity.position)) {
                const x = activity.x || activity.position?.x;
                const y = activity.y || activity.position?.y;
                dataLine += `(${x},${y}) `;
            }
            
            // Add description
            dataLine += description;
            
            // Add URL if available
            const url = activity.url || activity.pageContext?.url;
            if (url && url.length > 50) {
                // Truncate long URLs
                dataLine += ` [${url.substring(0, 50)}...]`;
            } else if (url) {
                dataLine += ` [${url}]`;
            }
            
            // Create the item with colored type
            const timeSpan = document.createElement('span');
            timeSpan.style.color = '#8b8b8b';
            timeSpan.textContent = `[${time}] `;
            
            const dataSpan = document.createElement('span');
            dataSpan.textContent = dataLine;
            
            item.appendChild(timeSpan);
            item.appendChild(typePrefix);
            item.appendChild(dataSpan);
        } else {
            // Regular mode: multi-line format
            const typeDiv = document.createElement('div');
            typeDiv.className = 'activity-type';
            typeDiv.textContent = `${getActivityIcon(activity.type)} ${activity.type}`;
            
            const descDiv = document.createElement('div');
            descDiv.className = 'activity-description';
            descDiv.textContent = description;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'activity-time';
            timeDiv.textContent = new Date(activity.timestamp).toLocaleTimeString();
            
            item.appendChild(typeDiv);
            item.appendChild(descDiv);
            item.appendChild(timeDiv);
        }
        
        feed.insertBefore(item, feed.firstChild);
        
        // Keep only last 50 items for better performance
        while (feed.children.length > 50) {
            feed.removeChild(feed.lastChild);
        }
    }
    
    /**
     * Handle step completion
     */
    handleStepCompleted(stepData) {
        if (this.engine) {
            const nodeData = {
                id: stepData.id,
                type: 'step',
                title: stepData.name,
                description: stepData.summary,
                events: stepData.events,
                timestamp: stepData.startTime,
                duration: stepData.duration
            };
            
            this.engine.addNode(nodeData);
            
            // Also add to canvas
            if (this.canvasBuilder) {
                this.canvasBuilder.addNode(nodeData);
            }
            
            this.updateProcessStats();
        }
    }
    
    /**
     * Update process statistics
     */
    updateProcessStats() {
        if (!this.engine) return;
        
        const nodes = Array.from(this.engine.process.nodes.values());
        const edges = this.engine.process.edges;
        
        document.getElementById('stat-steps').textContent = nodes.length;
        document.getElementById('stat-branches').textContent = edges.filter(e => e.type === 'branch').length;
        document.getElementById('stat-mapped').textContent = nodes.length > 0 ? '100%' : '0%';
    }
    
    /**
     * Setup export dialog
     */
    setupExportDialog() {
        const exportFormats = document.querySelectorAll('.export-format');
        const copyBtn = document.getElementById('copy-export');
        const downloadBtn = document.getElementById('download-export');
        const closeBtn = document.getElementById('close-export');
        const previewText = document.getElementById('export-preview-text');
        
        let selectedFormat = null;
        
        exportFormats.forEach(btn => {
            btn.addEventListener('click', () => {
                exportFormats.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedFormat = btn.dataset.format;
                
                // Generate preview
                if (this.engine) {
                    const exported = this.engine.exportForAutomation(selectedFormat);
                    previewText.value = exported;
                }
            });
        });
        
        copyBtn?.addEventListener('click', () => {
            if (previewText.value) {
                navigator.clipboard.writeText(previewText.value);
                this.showToast('Copied to clipboard', 'success');
            }
        });
        
        downloadBtn?.addEventListener('click', async () => {
            if (!selectedFormat || !previewText.value) {
                this.showToast('Please select a format first', 'warning');
                return;
            }
            
            const extensions = {
                'json': 'json',
                'yaml': 'yaml',
                'playwright': 'js',
                'puppeteer': 'js',
                'selenium': 'py',
                'python': 'py',
                'markdown': 'md',
                'plaintext': 'txt',
                'mermaid': 'mmd'
            };
            
            const extension = extensions[selectedFormat] || 'txt';
            const filename = `process-capture.${extension}`;
            
            if (window.electronAPI && window.electronAPI.saveFile) {
                const result = await window.electronAPI.saveFile({
                    content: previewText.value,
                    defaultPath: filename
                });
                
                if (result && result.success) {
                    this.showToast('File saved successfully', 'success');
                    this.hideExportDialog();
                }
            } else {
                // Fallback to browser download
                const blob = new Blob([previewText.value], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                this.showToast('File downloaded', 'success');
            }
        });
        
        closeBtn?.addEventListener('click', () => {
            this.hideExportDialog();
        });
    }
    
    /**
     * Show export dialog
     */
    showExportDialog() {
        const dialog = document.getElementById('export-dialog');
        dialog?.classList.remove('hidden');
        
        // Select first format by default
        const firstFormat = document.querySelector('.export-format');
        firstFormat?.click();
    }
    
    /**
     * Hide export dialog
     */
    hideExportDialog() {
        const dialog = document.getElementById('export-dialog');
        dialog?.classList.add('hidden');
    }
    
    /**
     * Setup theme management
     */
    setupTheme() {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
        
        // Update select
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedTheme;
        }
    }
    
    /**
     * Set application theme
     */
    setTheme(theme) {
        this.theme = theme;
        
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        
        localStorage.setItem('theme', theme);
    }
    
    /**
     * Set window opacity
     */
    setOpacity(value) {
        const opacity = value / 100;
        document.getElementById('opacity-value').textContent = `${value}%`;
        
        if (window.electronAPI) {
            window.electronAPI.setOpacity(opacity);
        }
    }
    
    /**
     * Set always on top
     */
    setAlwaysOnTop(enabled) {
        if (window.electronAPI) {
            window.electronAPI.setAlwaysOnTop(enabled);
        }
    }
    
    /**
     * Setup window controls
     */
    setupWindowControls() {
        document.getElementById('minimize-btn')?.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.minimizeWindow) {
                window.electronAPI.minimizeWindow();
            }
        });
        
        document.getElementById('maximize-btn')?.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.maximizeWindow) {
                window.electronAPI.maximizeWindow();
            }
        });
        
        document.getElementById('close-btn')?.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.closeWindow) {
                window.electronAPI.closeWindow();
            }
        });
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 300ms';
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }
    
    
    /**
     * Save process
     */
    async saveProcess() {
        if (!this.engine) {
            this.showToast('No process data to save', 'warning');
            return;
        }
        
        // Save to localStorage
        this.engine.save();
        this.showToast('Process saved locally', 'success');
        
        // If we have electronAPI, also save to file
        if (window.electronAPI && window.electronAPI.saveFile) {
            const exportData = this.engine.exportForAutomation('json');
            const result = await window.electronAPI.saveFile({
                content: exportData,
                defaultPath: 'process-capture.json',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (result && result.success) {
                this.showToast('Process exported to file', 'success');
            }
        }
    }
    
    /**
     * Capture browser session (cookies, localStorage, sessionStorage)
     */
    async captureSession() {
        if (!window.electronAPI) {
            this.showToast('Session capture not available', 'error');
            return;
        }
        
        this.showToast('Capturing browser session...', 'info');
        
        try {
            const result = await window.electronAPI.captureSession();
            
            if (result.success && result.sessionState) {
                // Store session in process engine
                if (this.engine) {
                    this.engine.setSessionState(result.sessionState);
                    this.engine.save(); // Save to localStorage
                }
                
                // Update UI
                this.updateSessionStatus(true, result.sessionState);
                
                const cookieCount = result.sessionState.cookies?.length || 0;
                const originsCount = result.sessionState.origins?.length || 0;
                
                this.showToast(
                    `Session captured! ${cookieCount} cookies, ${originsCount} storage origins`,
                    'success'
                );
            } else {
                this.showToast(result.error || 'Failed to capture session', 'error');
            }
        } catch (error) {
            console.error('Session capture error:', error);
            this.showToast('Failed to capture session', 'error');
        }
    }
    
    /**
     * Update session status indicator
     */
    updateSessionStatus(hasCaptured, sessionState = null) {
        const statusDot = document.getElementById('session-status-dot');
        const statusText = document.getElementById('session-status-text');
        
        if (hasCaptured && sessionState) {
            if (statusDot) {
                statusDot.style.background = 'var(--color-success)';
            }
            if (statusText) {
                const cookieCount = sessionState.cookies?.length || 0;
                const domain = sessionState.metadata?.domain || 'captured';
                statusText.textContent = `🔐 Session: ${cookieCount} cookies (${domain})`;
            }
        } else {
            if (statusDot) {
                statusDot.style.background = 'var(--text-disabled)';
            }
            if (statusText) {
                statusText.textContent = 'No Session Captured';
            }
        }
    }
    
    /**
     * Clear all data
     */
    async clearAllData() {
        const confirmed = confirm('Are you sure you want to clear all captured data?');
        if (!confirmed) return;
        
        if (this.engine) {
            this.engine.clearProcess();
            this.updateProcessStats();
            
            // Also clear session state
            this.engine.clearSessionState();
            this.updateSessionStatus(false);
        }
        
        // Clear canvas
        if (this.canvasBuilder) {
            this.canvasBuilder.clear();
        }
        
        // Clear activity feed
        const feed = document.getElementById('activity-feed');
        if (feed) {
            feed.innerHTML = '';
        }
        
        this.showToast('All data cleared', 'info');
    }
    
    /**
     * Setup terminal mode for activity feed
     */
    setupTerminalMode() {
        const toggleBtn = document.getElementById('terminal-mode-toggle');
        const activityFeed = document.getElementById('activity-feed');
        
        if (toggleBtn && activityFeed) {
            // Apply saved state
            if (this.terminalMode) {
                activityFeed.classList.add('terminal-mode');
                toggleBtn.classList.add('active');
            }
            
            // Toggle handler
            toggleBtn.addEventListener('click', () => {
                this.terminalMode = !this.terminalMode;
                
                if (this.terminalMode) {
                    activityFeed.classList.add('terminal-mode');
                    toggleBtn.classList.add('active');
                    this.showToast('Terminal mode enabled', 'success');
                } else {
                    activityFeed.classList.remove('terminal-mode');
                    toggleBtn.classList.remove('active');
                    this.showToast('Terminal mode disabled', 'info');
                }
                
                localStorage.setItem('terminalMode', this.terminalMode);
            });
        }
    }
    
    /**
     * Setup browser launch/reconnect controls
     */
    setupBrowserControls() {
        const launchBtn = document.getElementById('launch-browser-btn');
        
        if (launchBtn && window.electronAPI) {
            launchBtn.addEventListener('click', async () => {
                await this.launchOrReconnectBrowser();
            });
        }
    }
    
    /**
     * Launch new browser or reconnect to existing one
     */
    async launchOrReconnectBrowser() {
        const launchBtn = document.getElementById('launch-browser-btn');
        const statusDot = document.getElementById('browser-status-dot');
        const statusText = document.getElementById('browser-status-text');
        
        if (!window.electronAPI) {
            this.showToast('Browser launch not available', 'error');
            return;
        }
        
        // Update UI to connecting state
        if (launchBtn) {
            launchBtn.disabled = true;
            launchBtn.querySelector('span').textContent = '⏳ Connecting...';
        }
        if (statusDot) {
            statusDot.style.background = 'var(--color-warning)';
        }
        if (statusText) {
            statusText.textContent = 'Connecting...';
        }
        
        try {
            // First try to reconnect to existing browser
            const reconnectResult = await window.electronAPI.invoke('browser:connect');
            
            if (reconnectResult && reconnectResult.success) {
                this.showToast('Connected to browser', 'success');
                if (launchBtn) {
                    launchBtn.disabled = false;
                    launchBtn.querySelector('span').textContent = '✅ Browser Connected';
                }
            } else {
                // If reconnect fails, launch new browser
                this.showToast('Launching new browser...', 'info');
                const launchResult = await window.electronAPI.invoke('browser:launch');
                
                if (launchResult && launchResult.success) {
                    this.showToast('Browser launched successfully', 'success');
                    
                    // Wait a moment then try to connect
                    setTimeout(async () => {
                        await window.electronAPI.invoke('browser:connect');
                    }, 2000);
                } else {
                    throw new Error(launchResult?.error || 'Failed to launch browser');
                }
            }
        } catch (error) {
            console.error('Browser launch/reconnect error:', error);
            this.showToast(`Browser error: ${error.message}`, 'error');
            
            // Reset button state
            if (launchBtn) {
                launchBtn.disabled = false;
                launchBtn.querySelector('span').textContent = '🌐 Launch Capture Browser';
            }
            if (statusDot) {
                statusDot.style.background = 'var(--text-disabled)';
            }
            if (statusText) {
                statusText.textContent = 'Not Connected';
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modernApp = new ModernProcessCaptureApp();
});