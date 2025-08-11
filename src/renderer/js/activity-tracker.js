/**
 * Activity Tracker - Captures system-wide events and keystrokes
 * Works with Electron + iohook for desktop capture
 */

class ActivityTracker {
    constructor() {
        this.isCapturing = false;
        this.activityBuffer = [];
        this.recentKeystrokes = [];
        this.filters = {
            keystrokes: true,
            clicks: true,
            navigation: true,
            files: true
        };
        
        this.feedElement = document.getElementById('activity-feed');
        this.statusElement = document.getElementById('capture-status');
        
        // Event handlers for browser context
        this.setupBrowserTracking();
        
        // Will be initialized with Electron for desktop tracking
        this.desktopTracker = null;
        
        // Important action detection patterns
        this.importantPatterns = {
            copy: /ctrl\+c|cmd\+c/i,
            paste: /ctrl\+v|cmd\+v/i,
            save: /ctrl\+s|cmd\+s/i,
            search: /ctrl\+f|cmd\+f/i,
            selectAll: /ctrl\+a|cmd\+a/i,
            undo: /ctrl\+z|cmd\+z/i,
            tab: /tab/i,
            enter: /enter|return/i,
            escape: /esc/i
        };
        
        this.setupHotkeys();
    }

    /**
     * Setup browser-based tracking
     */
    setupBrowserTracking() {
        // Track clicks
        document.addEventListener('click', (e) => {
            if (!this.isCapturing || !this.filters.clicks) return;
            
            const target = e.target;
            const activity = {
                type: 'click',
                timestamp: Date.now(),
                element: this.extractElementInfo(target),
                position: { x: e.clientX, y: e.clientY },
                context: this.getCurrentContext()
            };
            
            this.addActivity(activity);
        }, true);

        // Track keyboard input
        document.addEventListener('keydown', (e) => {
            if (!this.isCapturing || !this.filters.keystrokes) return;
            
            const key = this.getKeyCombo(e);
            this.recentKeystrokes.push(key);
            
            // Keep only last 20 keystrokes
            if (this.recentKeystrokes.length > 20) {
                this.recentKeystrokes.shift();
            }
            
            // Check if it's an important key combo
            const isImportant = this.isImportantKeystroke(key);
            
            const activity = {
                type: 'keystroke',
                timestamp: Date.now(),
                key: key,
                isImportant: isImportant,
                context: this.getCurrentContext()
            };
            
            if (isImportant) {
                this.addActivity(activity);
                
                // Auto-prompt for context on important actions
                if (this.shouldPromptForContext(key)) {
                    this.promptForActionContext(activity);
                }
            }
        }, true);

        // Track form inputs (sanitized)
        document.addEventListener('input', (e) => {
            if (!this.isCapturing) return;
            
            const target = e.target;
            const activity = {
                type: 'input',
                timestamp: Date.now(),
                field: {
                    name: target.name,
                    id: target.id,
                    type: target.type,
                    label: this.findFieldLabel(target)
                },
                valueLength: target.value.length,
                context: this.getCurrentContext()
            };
            
            // Don't store actual values for security
            if (target.type === 'password') {
                activity.isCredential = true;
            }
            
            this.addActivity(activity);
        });

        // Track file selections
        document.addEventListener('change', (e) => {
            if (!this.isCapturing || !this.filters.files) return;
            
            const target = e.target;
            if (target.type === 'file') {
                const files = Array.from(target.files);
                const activity = {
                    type: 'file_select',
                    timestamp: Date.now(),
                    files: files.map(f => ({
                        name: f.name,
                        type: f.type,
                        size: f.size
                    })),
                    context: this.getCurrentContext()
                };
                
                this.addActivity(activity);
            }
        });

        // Track navigation (for web context)
        if (window.navigation) {
            window.navigation.addEventListener('navigate', (e) => {
                if (!this.isCapturing || !this.filters.navigation) return;
                
                const activity = {
                    type: 'navigation',
                    timestamp: Date.now(),
                    url: e.destination.url,
                    context: this.getCurrentContext()
                };
                
                this.addActivity(activity);
            });
        }
    }

    /**
     * Setup Electron/desktop tracking (when available)
     */
    setupDesktopTracking() {
        // This will be called from Electron main process
        if (window.electronAPI) {
            // Listen for system-wide events from Electron
            window.electronAPI.onSystemEvent((event) => {
                if (!this.isCapturing) return;
                
                switch (event.type) {
                    case 'app_switch':
                        this.handleAppSwitch(event);
                        break;
                    case 'file_open':
                        this.handleFileOpen(event);
                        break;
                    case 'window_focus':
                        this.handleWindowFocus(event);
                        break;
                    case 'clipboard':
                        this.handleClipboard(event);
                        break;
                }
            });
        }
    }

    /**
     * Handle application switching
     */
    handleAppSwitch(event) {
        const activity = {
            type: 'app_switch',
            timestamp: Date.now(),
            from: event.fromApp,
            to: event.toApp,
            window: event.windowTitle,
            isImportant: true
        };
        
        this.addActivity(activity);
        
        // Auto-capture context when switching to key apps
        if (this.isKeyApplication(event.toApp)) {
            this.captureApplicationContext(event.toApp);
        }
    }

    /**
     * Handle file operations
     */
    handleFileOpen(event) {
        const activity = {
            type: 'file_operation',
            timestamp: Date.now(),
            operation: event.operation, // 'open', 'save', 'close'
            filePath: event.path,
            fileName: event.name,
            fileType: this.getFileType(event.name),
            application: event.application,
            isImportant: true
        };
        
        this.addActivity(activity);
        
        // Special handling for Excel/CSV files
        if (activity.fileType === 'excel' || activity.fileType === 'csv') {
            this.promptForSpreadsheetContext(activity);
        }
    }

    /**
     * Extract element information for automation
     */
    extractElementInfo(element) {
        if (!element) return null;
        
        return {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            text: element.innerText?.substring(0, 50),
            selector: this.generateSelector(element),
            xpath: this.getXPath(element),
            attributes: this.getRelevantAttributes(element),
            position: element.getBoundingClientRect(),
            isButton: element.tagName === 'BUTTON' || element.type === 'button',
            isLink: element.tagName === 'A',
            isInput: element.tagName === 'INPUT' || element.tagName === 'TEXTAREA'
        };
    }

    /**
     * Generate robust CSS selector
     */
    generateSelector(element) {
        if (element.id) return `#${element.id}`;
        
        let path = [];
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                selector = `#${current.id}`;
                path.unshift(selector);
                break;
            } else if (current.className) {
                selector += `.${current.className.split(' ').join('.')}`;
            }
            
            // Add nth-child if needed
            let sibling = current;
            let nth = 1;
            while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                if (sibling.tagName === current.tagName) nth++;
            }
            
            if (nth > 1) {
                selector += `:nth-of-type(${nth})`;
            }
            
            path.unshift(selector);
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }

    /**
     * Generate XPath
     */
    getXPath(element) {
        if (element.id) return `//*[@id="${element.id}"]`;
        
        let path = [];
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = current;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && 
                    sibling.tagName === current.tagName) {
                    index++;
                }
                sibling = sibling.previousSibling;
            }
            
            path.unshift(`${current.tagName.toLowerCase()}[${index}]`);
            current = current.parentElement;
        }
        
        return '/' + path.join('/');
    }

    /**
     * Get relevant attributes from element
     */
    getRelevantAttributes(element) {
        const relevantAttrs = ['href', 'src', 'name', 'type', 'value', 'placeholder', 
                               'data-testid', 'data-id', 'aria-label', 'role'];
        const attributes = {};
        
        for (const attr of relevantAttrs) {
            const value = element.getAttribute(attr);
            if (value) {
                // Don't store sensitive values
                if (attr === 'value' && (element.type === 'password' || 
                    element.getAttribute('data-sensitive'))) {
                    attributes[attr] = '[PROTECTED]';
                } else {
                    attributes[attr] = value;
                }
            }
        }
        
        return attributes;
    }

    /**
     * Add activity to feed and buffer
     */
    addActivity(activity) {
        // Add to buffer
        this.activityBuffer.push(activity);
        
        // Limit buffer size
        if (this.activityBuffer.length > 1000) {
            this.activityBuffer.shift();
        }
        
        // Update UI
        this.renderActivity(activity);
        
        // Check if this should create a process node
        if (activity.isImportant || this.shouldAutoCapture(activity)) {
            this.notifyProcessEngine(activity);
        }
    }

    /**
     * Render activity in the feed
     */
    renderActivity(activity) {
        const entry = document.createElement('div');
        entry.className = `activity-entry ${activity.isImportant ? 'important' : ''}`;
        entry.dataset.activityId = activity.timestamp;
        
        const timestamp = new Date(activity.timestamp).toLocaleTimeString();
        const icon = this.getActivityIcon(activity.type);
        let description = this.getActivityDescription(activity);
        
        // Add application context if available
        let contextInfo = '';
        if (activity.application && activity.application !== 'Unknown') {
            contextInfo = `<div class="app-context">📍 ${activity.application}`;
            
            // Add page context if available (from Playwright)
            if (activity.pageContext?.url) {
                contextInfo += ` - ${activity.pageContext.url}`;
            } else if (activity.browserContext?.url) {
                contextInfo += ` - ${activity.browserContext.url}`;
            } else if (activity.window && activity.window !== 'Unknown') {
                contextInfo += ` - ${activity.window}`;
            }
            contextInfo += '</div>';
        }
        
        // Add element selector info if available (from Playwright)
        let selectorInfo = '';
        if (activity.element?.selectors) {
            const selectors = activity.element.selectors;
            selectorInfo = '<div class="selector-info">';
            if (selectors.id) {
                selectorInfo += `<span class="selector-id">${selectors.id}</span>`;
            } else if (selectors.css) {
                selectorInfo += `<span class="selector-css">${selectors.css}</span>`;
            }
            selectorInfo += '</div>';
        }
        
        entry.innerHTML = `
            <div class="timestamp">${timestamp}</div>
            <div class="activity-type">
                ${icon} ${description}
            </div>
            ${contextInfo}
            ${selectorInfo}
            ${activity.details ? `<div class="details">${activity.details}</div>` : ''}
        `;
        
        // Add click handler to mark as step
        entry.addEventListener('click', () => {
            this.markAsStep(activity);
        });
        
        // Add to feed
        this.feedElement.insertBefore(entry, this.feedElement.firstChild);
        
        // Limit feed display
        while (this.feedElement.children.length > 50) {
            this.feedElement.removeChild(this.feedElement.lastChild);
        }
    }

    /**
     * Get activity icon
     */
    getActivityIcon(type) {
        const icons = {
            click: '🖱️',
            keystroke: '⌨️',
            input: '✏️',
            navigation: '🔗',
            file_select: '📁',
            file_operation: '📄',
            app_switch: '🔄',
            copy: '📋',
            paste: '📌',
            decision: '🔀',
            'marked-action': '🎯',
            'text-input': '💬'
        };
        
        return icons[type] || '▶️';
    }

    /**
     * Get human-readable activity description
     */
    getActivityDescription(activity) {
        switch (activity.type) {
            case 'click':
                // Use rich element context from Playwright if available
                if (activity.element?.selectors?.text) {
                    // Truncate long text
                    const text = activity.element.selectors.text;
                    const displayText = text.length > 50 ? text.substring(0, 47) + '...' : text;
                    return `Clicked "${displayText}"`;
                } else if (activity.element?.tag) {
                    // Use element tag and type
                    let desc = `Clicked <${activity.element.tag}>`;
                    if (activity.element.type) {
                        desc += ` (${activity.element.type})`;
                    }
                    if (activity.element.name) {
                        desc += ` "${activity.element.name}"`;
                    }
                    return desc;
                } else if (activity.browserContext?.pageTitle) {
                    return `Clicked in "${activity.browserContext.pageTitle}"`;
                } else if (activity.description) {
                    // Use pre-built description from capture service
                    return activity.description;
                } else {
                    return 'Clicked';
                }
            
            case 'keystroke':
                return `Pressed ${activity.key}`;
            
            case 'input':
                return `Entered text in ${activity.field?.label || activity.field?.name || 'field'}`;
            
            case 'navigation':
                return `Navigated to ${new URL(activity.url).pathname}`;
            
            case 'file_select':
                return `Selected ${activity.files.length} file(s)`;
            
            case 'file_operation':
                return `${activity.operation} file: ${activity.fileName}`;
            
            case 'app_switch':
                return `Switched to ${activity.to}`;
            
            case 'mark_important':
                return 'Marked as important step';
            
            case 'marked-action':
                // Display the summary from Mark Before capture
                if (activity.summary) {
                    return activity.summary;
                } else if (activity.capturedText) {
                    return `Typed: "${activity.capturedText}"`;
                } else {
                    return `Captured ${activity.eventCount || 0} events`;
                }
            
            case 'text-input':
                return activity.capturedText ? `Typed: "${activity.capturedText}"` : 'Text input';
            
            default:
                return activity.description || activity.type;
        }
    }

    /**
     * Mark activity as an important step
     */
    markAsStep(activity) {
        // Show dialog to capture context
        window.processApp.showStepDialog(activity);
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
        return false;
    }

    /**
     * Get key combination string
     */
    getKeyCombo(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Cmd');
        
        // Add the actual key
        if (event.key && event.key !== 'Control' && event.key !== 'Alt' && 
            event.key !== 'Shift' && event.key !== 'Meta') {
            parts.push(event.key);
        }
        
        return parts.join('+');
    }

    /**
     * Find label for form field
     */
    findFieldLabel(element) {
        // Check for associated label
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.innerText;
        }
        
        // Check for aria-label
        if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
        }
        
        // Check for placeholder
        if (element.placeholder) {
            return element.placeholder;
        }
        
        // Check parent for label
        let parent = element.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
            const label = parent.querySelector('label');
            if (label) return label.innerText;
            parent = parent.parentElement;
        }
        
        return null;
    }

    /**
     * Get current context
     */
    getCurrentContext() {
        return {
            url: window.location?.href,
            title: document.title,
            application: this.detectApplication(),
            timestamp: Date.now()
        };
    }

    /**
     * Detect current application context
     */
    detectApplication() {
        // Browser-based detection
        const host = window.location?.hostname || '';
        
        if (host.includes('docs.google.com')) return 'Google Docs';
        if (host.includes('sheets.google.com')) return 'Google Sheets';
        if (host.includes('gmail.com')) return 'Gmail';
        if (host.includes('outlook.com')) return 'Outlook Web';
        if (host.includes('salesforce.com')) return 'Salesforce';
        if (host.includes('github.com')) return 'GitHub';
        
        // Will be enhanced with Electron for desktop apps
        return 'Browser';
    }

    /**
     * Setup keyboard shortcuts
     */
    setupHotkeys() {
        // Ctrl+Shift+M - Mark as important step
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                this.markCurrentAsStep();
            }
            
            // Ctrl+Shift+C - Start/stop capture
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.toggleCapture();
            }
        });
    }

    /**
     * Mark current moment as step
     */
    markCurrentAsStep() {
        const recentActivity = this.activityBuffer[this.activityBuffer.length - 1];
        
        if (recentActivity) {
            recentActivity.isImportant = true;
            this.markAsStep(recentActivity);
        } else {
            // Create a manual marker
            const manualStep = {
                type: 'manual_mark',
                timestamp: Date.now(),
                context: this.getCurrentContext(),
                isImportant: true
            };
            
            this.addActivity(manualStep);
            this.markAsStep(manualStep);
        }
    }

    /**
     * Start/stop capture
     */
    toggleCapture() {
        if (this.isCapturing) {
            this.stopCapture();
        } else {
            this.startCapture();
        }
    }

    startCapture() {
        this.isCapturing = true;
        this.statusElement.classList.add('active');
        this.statusElement.querySelector('.status-text').textContent = 'Recording';
        
        document.getElementById('start-capture').disabled = true;
        document.getElementById('pause-capture').disabled = false;
        
        // Notify other components
        window.processApp?.onCaptureStart();
    }

    stopCapture() {
        this.isCapturing = false;
        this.statusElement.classList.remove('active');
        this.statusElement.querySelector('.status-text').textContent = 'Paused';
        
        document.getElementById('start-capture').disabled = false;
        document.getElementById('pause-capture').disabled = true;
        
        // Notify other components
        window.processApp?.onCaptureStop();
    }

    /**
     * Check if application is key for process
     */
    isKeyApplication(appName) {
        const keyApps = ['Excel', 'Chrome', 'Outlook', 'Word', 'Salesforce'];
        return keyApps.some(app => appName.includes(app));
    }

    /**
     * Get file type from name
     */
    getFileType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        
        const types = {
            xlsx: 'excel',
            xls: 'excel',
            csv: 'csv',
            pdf: 'pdf',
            docx: 'word',
            doc: 'word',
            txt: 'text'
        };
        
        return types[ext] || ext;
    }

    /**
     * Should auto-capture this activity
     */
    shouldAutoCapture(activity) {
        // Auto-capture file operations, app switches, and certain keystrokes
        return activity.type === 'file_operation' ||
               activity.type === 'app_switch' ||
               (activity.type === 'keystroke' && activity.isImportant);
    }

    /**
     * Should prompt for context
     */
    shouldPromptForContext(key) {
        return key.includes('Ctrl+C') || key.includes('Ctrl+V') || 
               key.includes('Enter') || key.includes('Tab');
    }

    /**
     * Notify process engine of important activity
     */
    notifyProcessEngine(activity) {
        if (window.processEngine) {
            window.processEngine.handleActivity(activity);
        }
    }

    /**
     * Export activity log
     */
    exportLog() {
        return this.activityBuffer;
    }

    /**
     * Clear activity log
     */
    clearLog() {
        this.activityBuffer = [];
        this.feedElement.innerHTML = '';
    }
}

// Initialize tracker
window.activityTracker = new ActivityTracker();