/**
 * Mapping Controller - Manages the field mapping UI and user interactions
 */

class MappingController {
    constructor() {
        this.isActive = false;
        this.mappingService = null;
        this.mappings = [];
        this.sessionState = null;  // Store captured session
        this.elements = {};
        
        this.initialize();
    }
    
    /**
     * Initialize the controller
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        
        console.log('🔗 Mapping Controller initialized');
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Main button
            createMappingBtn: document.getElementById('create-mapping'),
            
            // Overlay elements
            overlay: document.getElementById('mapping-overlay'),
            exitBtn: document.getElementById('exit-mapping'),
            doneBtn: document.getElementById('done-mapping'),
            testBtn: document.getElementById('test-mapping'),
            clearBtn: document.getElementById('clear-mappings'),
            captureSessionBtn: document.getElementById('capture-session'),
            
            // Display elements
            prompt: document.getElementById('mapping-prompt'),
            status: document.getElementById('mapping-status'),
            mappingsDisplay: document.getElementById('mappings-display'),
        };
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Main button to start mapping mode
        this.elements.createMappingBtn?.addEventListener('click', () => {
            this.startMappingMode();
        });
        
        // Exit mapping mode
        this.elements.exitBtn?.addEventListener('click', () => {
            this.exitMappingMode();
        });
        
        // Done button
        this.elements.doneBtn?.addEventListener('click', () => {
            this.completeMappingMode();
        });
        
        // Test mapping button
        this.elements.testBtn?.addEventListener('click', () => {
            this.testMapping();
        });
        
        // Clear all mappings
        this.elements.clearBtn?.addEventListener('click', () => {
            this.clearAllMappings();
        });
        
        // Capture session button
        this.elements.captureSessionBtn?.addEventListener('click', () => {
            this.captureSession();
        });
    }
    
    /**
     * Setup IPC listeners for mapping events
     */
    setupIPCListeners() {
        // Listen for mapping events from main process
        window.electronAPI.onMappingEvent((data) => {
            this.handleMappingEvent(data);
        });
        
        // Listen for captured clicks during mapping mode
        window.electronAPI.onCaptureActivity((event) => {
            if (this.isActive) {
                this.handleCaptureEvent(event);
            }
        });
    }
    
    /**
     * Start mapping mode
     */
    async startMappingMode() {
        console.log('🔗 Starting field mapping mode');
        
        // Check if capture is running
        const captureStatus = document.getElementById('capture-status');
        const isCapturing = captureStatus?.classList.contains('recording');
        
        if (!isCapturing) {
            this.showMessage('Please start capture first to begin mapping', 'error');
            return;
        }
        
        // Initialize mapping mode
        const result = await window.electronAPI.startMappingMode();
        
        if (result.success) {
            this.isActive = true;
            this.mappings = [];
            
            // Show overlay
            this.elements.overlay.classList.remove('hidden');
            
            // Update UI
            this.updatePrompt('Click on a CSV/Excel column or cell to start mapping...');
            this.updateMappingsDisplay();
            
            // Disable main button
            this.elements.createMappingBtn.disabled = true;
        } else {
            this.showMessage('Failed to start mapping mode', 'error');
        }
    }
    
    /**
     * Exit mapping mode without saving
     */
    exitMappingMode() {
        this.isActive = false;
        this.elements.overlay.classList.add('hidden');
        this.elements.createMappingBtn.disabled = false;
        
        // Stop mapping mode in main process
        window.electronAPI.stopMappingMode();
        
        console.log('🔗 Exited mapping mode');
    }
    
    /**
     * Complete mapping mode and save mappings
     */
    async completeMappingMode() {
        if (this.mappings.length === 0) {
            this.showMessage('No mappings created', 'warning');
            return;
        }
        
        // Get mappings from service
        const result = await window.electronAPI.getMappings();
        
        if (result.success && result.mappings.length > 0) {
            this.showMessage(`Saved ${result.mappings.length} field mappings`, 'success');
            
            // Store mappings for export
            this.storeMappingsForExport(result.mappings);
        }
        
        this.exitMappingMode();
    }
    
    /**
     * Handle capture events during mapping mode
     */
    handleCaptureEvent(event) {
        if (!this.isActive) return;
        
        // Send event to mapping service for processing
        window.electronAPI.processMappingClick(event);
    }
    
    /**
     * Handle mapping events from main process
     */
    handleMappingEvent(data) {
        switch (data.status) {
            case 'source_captured':
                this.handleSourceCaptured(data);
                break;
                
            case 'navigation_captured':
                this.handleNavigationCaptured(data);
                break;
                
            case 'continue_recording':
                // Silent - just continue recording navigation
                break;
                
            case 'mapping_created':
                this.handleMappingCreated(data);
                break;
                
            case 'error':
                this.showMessage(data.message, 'error');
                break;
        }
    }
    
    /**
     * Handle source captured event
     */
    handleSourceCaptured(data) {
        this.updatePrompt(`Source captured: ${data.source.display}. Now navigate to and click on the form field.`);
        this.showStatus(`📊 Source: ${data.source.display}`, 'info');
        
        // Visual feedback
        this.elements.overlay.classList.add('source-captured');
    }
    
    /**
     * Handle navigation step captured
     */
    handleNavigationCaptured(data) {
        // Show brief feedback about navigation
        const actionLabels = {
            'tab_click': '📑 Tab clicked',
            'dropdown_open': '📋 Dropdown opened',
            'expand_section': '▼ Section expanded',
            'open_modal': '🔲 Modal opened',
            'scroll': '↕️ Scrolled',
            'tab_key': '⌨️ Tab key pressed',
            'enter_key': '⏎ Enter pressed',
            'navigation_click': '🔗 Navigation'
        };
        
        const label = actionLabels[data.step.action] || data.step.action;
        this.showStatus(`${label} (${data.totalSteps} steps)`, 'navigation');
    }
    
    /**
     * Handle mapping created event
     */
    handleMappingCreated(data) {
        this.mappings.push(data.mapping);
        
        // Update prompt for next mapping
        this.updatePrompt('Click another CSV/Excel column or click Done to finish');
        this.showStatus(`✅ Mapped: ${data.mapping.source.display} → ${data.mapping.destination.display}`, 'success');
        
        // Remove visual feedback
        this.elements.overlay.classList.remove('source-captured');
        
        // Update display
        this.updateMappingsDisplay();
        
        // Enable action buttons
        this.elements.testBtn.disabled = false;
        this.elements.clearBtn.disabled = false;
    }
    
    /**
     * Update the prompt text
     */
    updatePrompt(text) {
        this.elements.prompt.textContent = text;
    }
    
    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = `mapping-status ${type}`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.elements.status.textContent = '';
        }, 3000);
    }
    
    /**
     * Update mappings display
     */
    updateMappingsDisplay() {
        if (this.mappings.length === 0) {
            this.elements.mappingsDisplay.innerHTML = '<div class="no-mappings">No mappings created yet</div>';
            return;
        }
        
        let html = '<div class="mapping-items">';
        
        this.mappings.forEach((mapping, index) => {
            const hasNavigation = mapping.navigationSteps && mapping.navigationSteps.length > 0;
            const navCount = hasNavigation ? mapping.navigationSteps.length : 0;
            
            html += `
                <div class="mapping-item ${hasNavigation ? 'has-navigation' : ''}">
                    <span class="mapping-number">${index + 1}</span>
                    <span class="mapping-source">${mapping.source.display}</span>
                    <span class="mapping-arrow">→</span>
                    ${hasNavigation ? `<span class="navigation-badge" title="${navCount} navigation step${navCount > 1 ? 's' : ''}">${navCount}⚡</span>` : ''}
                    <span class="mapping-destination">${mapping.destination.display}</span>
                    <button class="btn-remove" onclick="mappingController.removeMapping('${mapping.id}')">×</button>
                </div>
            `;
        });
        
        html += '</div>';
        this.elements.mappingsDisplay.innerHTML = html;
    }
    
    /**
     * Remove a mapping
     */
    async removeMapping(mappingId) {
        const result = await window.electronAPI.removeMapping(mappingId);
        
        if (result.success) {
            // Remove from local array
            this.mappings = this.mappings.filter(m => m.id !== mappingId);
            this.updateMappingsDisplay();
            
            // Disable buttons if no mappings left
            if (this.mappings.length === 0) {
                this.elements.testBtn.disabled = true;
                this.elements.clearBtn.disabled = true;
            }
        }
    }
    
    /**
     * Clear all mappings
     */
    async clearAllMappings() {
        const result = await window.electronAPI.clearMappings();
        
        if (result.success) {
            this.mappings = [];
            this.updateMappingsDisplay();
            this.elements.testBtn.disabled = true;
            this.elements.clearBtn.disabled = true;
            this.showStatus('All mappings cleared', 'info');
        }
    }
    
    /**
     * Test mapping with first row
     */
    async testMapping() {
        if (this.mappings.length === 0) return;
        
        this.showStatus('Testing mappings with first row...', 'info');
        
        // This would trigger a test execution
        // For now, just show the mappings
        let testOutput = 'Test Preview:\n';
        this.mappings.forEach(m => {
            testOutput += `${m.source.display}: "${m.source.sampleValue}" → ${m.destination.display}\n`;
        });
        
        console.log(testOutput);
        this.showStatus('Test completed - check console', 'success');
    }
    
    /**
     * Store mappings for export
     */
    storeMappingsForExport(mappings) {
        // Include session state if captured
        const exportData = {
            mappings: mappings,
            sessionState: this.sessionState
        };
        
        // Store in localStorage
        localStorage.setItem('field_mappings', JSON.stringify(mappings));
        if (this.sessionState) {
            localStorage.setItem('field_mapping_session', JSON.stringify(this.sessionState));
        }
        
        // Notify that mappings are available for export
        window.electronAPI.storeMappingsForExport(exportData);
    }
    
    /**
     * Capture browser session (cookies, localStorage, etc.)
     */
    async captureSession() {
        try {
            // Disable button temporarily
            this.elements.captureSessionBtn.disabled = true;
            this.elements.captureSessionBtn.textContent = '⏳ Capturing...';
            
            // Call the session capture API
            const result = await window.electronAPI.captureSession();
            
            if (result.success && result.sessionState) {
                this.sessionState = result.sessionState;
                
                // Update button to show success
                this.elements.captureSessionBtn.textContent = '✅ Session Captured';
                this.elements.captureSessionBtn.classList.add('success');
                
                // Show success message
                this.showStatus('🔐 Browser session captured successfully! Login state will be preserved.', 'success');
                
                // Store session indicator
                localStorage.setItem('has_session', 'true');
                
                console.log('🔐 Session captured:', {
                    cookies: result.sessionState.cookies?.length || 0,
                    hasLocalStorage: !!result.sessionState.origins
                });
                
                // Keep button disabled but show captured state
                setTimeout(() => {
                    this.elements.captureSessionBtn.textContent = '🔐 Session Captured';
                }, 3000);
                
            } else {
                throw new Error(result.error || 'Failed to capture session');
            }
            
        } catch (error) {
            console.error('Failed to capture session:', error);
            this.showStatus('❌ Failed to capture session. Make sure browser is connected.', 'error');
            
            // Reset button
            this.elements.captureSessionBtn.disabled = false;
            this.elements.captureSessionBtn.textContent = '🔐 Capture Session';
            this.elements.captureSessionBtn.classList.remove('success');
        }
    }
    
    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        // Could use a toast notification or update status
        this.showStatus(message, type);
        console.log(`🔗 ${type}: ${message}`);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mappingController = new MappingController();
    });
} else {
    window.mappingController = new MappingController();
}