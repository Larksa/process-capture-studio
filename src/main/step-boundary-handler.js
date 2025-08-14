/**
 * Step Boundary Handler
 * 
 * Manages the Start Step → Do Work → End Step workflow
 * Captures all events between step boundaries as a single logical unit
 */

class StepBoundaryHandler {
    constructor() {
        this.isStepActive = false;
        this.currentStep = null;
        this.capturedEvents = [];
        this.stepStartTime = null;
        this.mainWindow = null;
        this.stepCounter = 0;
    }
    
    /**
     * Initialize with main window reference
     */
    init(mainWindow) {
        this.mainWindow = mainWindow;
    }
    
    /**
     * Start a new step
     */
    startStep(description = '') {
        if (this.isStepActive) {
            console.log('[StepBoundary] Step already in progress, ending current step first');
            this.endStep('auto-completed', 'Started new step');
        }
        
        console.log('[StepBoundary] Starting new step:', description);
        
        this.isStepActive = true;
        this.stepStartTime = Date.now();
        this.capturedEvents = [];
        this.stepCounter++;
        
        this.currentStep = {
            id: `step-${this.stepCounter}`,
            name: description || `Step ${this.stepCounter}`,
            startTime: this.stepStartTime,
            events: [],
            status: 'recording'
        };
        
        // Notify renderer that step has started
        if (this.mainWindow) {
            this.mainWindow.webContents.send('step:started', {
                id: this.currentStep.id,
                name: this.currentStep.name,
                timestamp: this.stepStartTime
            });
        }
        
        return this.currentStep.id;
    }
    
    /**
     * End the current step
     */
    endStep(mode = 'quick', additionalContext = '') {
        if (!this.isStepActive) {
            console.log('[StepBoundary] No step in progress to end');
            return null;
        }
        
        console.log(`[StepBoundary] Ending step. Mode: ${mode}, Events: ${this.capturedEvents.length}`);
        
        const duration = Date.now() - this.stepStartTime;
        
        // Package the step data
        const stepData = {
            id: this.currentStep.id,
            name: this.currentStep.name,
            startTime: this.stepStartTime,
            endTime: Date.now(),
            duration: duration,
            events: this.capturedEvents,
            eventCount: this.capturedEvents.length,
            mode: mode, // 'quick' or 'detailed'
            additionalContext: additionalContext,
            
            // Smart summary of what happened
            summary: this.generateStepSummary(this.capturedEvents),
            
            // Detect the primary action
            primaryAction: this.detectPrimaryAction(this.capturedEvents),
            
            // Extract key elements interacted with
            keyElements: this.extractKeyElements(this.capturedEvents),
            
            // Detect if this was a form submission, login, search, etc.
            patternType: this.detectPatternType(this.capturedEvents)
        };
        
        // Reset state
        this.isStepActive = false;
        this.currentStep = null;
        this.capturedEvents = [];
        this.stepStartTime = null;
        
        // Notify renderer that step has ended
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('step:completed', stepData);
        }
        
        return stepData;
    }
    
    /**
     * Process an event while step is active
     */
    processEvent(event) {
        if (!this.isStepActive) {
            // Not in a step, ignore or buffer
            return false;
        }
        
        // Add relative time to event
        event.relativeTime = Date.now() - this.stepStartTime;
        
        // Store the event
        this.capturedEvents.push(event);
        
        // Update UI with event count
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('step:event-added', {
                stepId: this.currentStep.id,
                eventCount: this.capturedEvents.length,
                duration: Math.floor((Date.now() - this.stepStartTime) / 1000)
            });
        }
        
        return true;
    }
    
    /**
     * Generate smart summary of step
     */
    generateStepSummary(events) {
        if (events.length === 0) return 'No actions captured';
        
        // Look for key patterns
        const hasLogin = events.some(e => 
            e.element?.type === 'password' || 
            e.element?.name?.includes('password') ||
            e.element?.id?.includes('login')
        );
        
        if (hasLogin) {
            return 'Login to system';
        }
        
        // Check for form submission
        const hasFormSubmit = events.some(e => 
            e.type === 'click' && (
                e.element?.type === 'submit' ||
                e.element?.text?.toLowerCase().includes('submit') ||
                e.element?.text?.toLowerCase().includes('save')
            )
        );
        
        if (hasFormSubmit) {
            const typedText = events.filter(e => e.type === 'typed_text').map(e => e.text).join(', ');
            if (typedText) {
                return `Submitted form with: ${typedText.substring(0, 50)}`;
            }
            return 'Submitted form';
        }
        
        // Check for search
        const hasSearch = events.some(e => 
            e.element?.type === 'search' ||
            e.element?.placeholder?.includes('search') ||
            e.element?.name?.includes('search')
        );
        
        if (hasSearch) {
            const searchText = events.find(e => e.type === 'typed_text')?.text;
            if (searchText) {
                return `Searched for: ${searchText}`;
            }
            return 'Performed search';
        }
        
        // Check for navigation
        const urlChange = events.filter(e => e.pageContext?.url);
        if (urlChange.length > 1) {
            const lastUrl = urlChange[urlChange.length - 1].pageContext.url;
            try {
                const url = new URL(lastUrl);
                return `Navigated to ${url.pathname}`;
            } catch {
                return 'Navigated to new page';
            }
        }
        
        // Default summary based on event types
        const clicks = events.filter(e => e.type === 'click').length;
        const typing = events.filter(e => e.type === 'typed_text').length;
        
        if (clicks > 0 && typing > 0) {
            return `Entered data and clicked ${clicks} times`;
        } else if (typing > 0) {
            return `Entered text in ${typing} field(s)`;
        } else if (clicks > 0) {
            return `Clicked ${clicks} element(s)`;
        }
        
        return `Performed ${events.length} actions`;
    }
    
    /**
     * Detect the primary action in the step
     */
    detectPrimaryAction(events) {
        // Last meaningful action is often the primary one
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            
            // Submit buttons are primary
            if (event.type === 'click' && event.element?.type === 'submit') {
                return {
                    type: 'submit',
                    description: event.element.text || 'Submit form',
                    element: event.element
                };
            }
            
            // Login buttons
            if (event.type === 'click' && (
                event.element?.text?.toLowerCase().includes('login') ||
                event.element?.text?.toLowerCase().includes('sign in')
            )) {
                return {
                    type: 'login',
                    description: 'Login to system',
                    element: event.element
                };
            }
        }
        
        // If no specific primary action, use the last click
        const lastClick = events.findLast(e => e.type === 'click');
        if (lastClick) {
            return {
                type: 'click',
                description: lastClick.element?.text || 'Click element',
                element: lastClick.element
            };
        }
        
        return null;
    }
    
    /**
     * Extract key elements that were interacted with
     */
    extractKeyElements(events) {
        const elements = [];
        const seen = new Set();
        
        events.forEach(event => {
            if (event.element && event.element.selector) {
                const key = event.element.selector;
                if (!seen.has(key)) {
                    seen.add(key);
                    elements.push({
                        selector: event.element.selector,
                        type: event.element.type || event.element.tagName,
                        text: event.element.text,
                        name: event.element.name,
                        id: event.element.id
                    });
                }
            }
        });
        
        return elements;
    }
    
    /**
     * Detect pattern type (login, search, form fill, etc.)
     */
    detectPatternType(events) {
        // Check for login pattern
        const hasUsername = events.some(e => 
            e.element?.type === 'email' || 
            e.element?.name?.includes('user') ||
            e.element?.name?.includes('email')
        );
        const hasPassword = events.some(e => 
            e.element?.type === 'password'
        );
        
        if (hasUsername && hasPassword) {
            return 'login';
        }
        
        // Check for search pattern
        if (events.some(e => e.element?.type === 'search')) {
            return 'search';
        }
        
        // Check for form fill
        const inputCount = events.filter(e => 
            e.type === 'click' && e.element?.tagName === 'INPUT'
        ).length;
        
        if (inputCount >= 3) {
            return 'form-fill';
        }
        
        // Check for file operations
        if (events.some(e => 
            e.element?.type === 'file' ||
            e.element?.text?.includes('Download') ||
            e.element?.text?.includes('Upload')
        )) {
            return 'file-operation';
        }
        
        return 'general';
    }
    
    /**
     * Check if step is currently active
     */
    isActive() {
        return this.isStepActive;
    }
    
    /**
     * Get current step info
     */
    getCurrentStep() {
        return this.currentStep;
    }
}

module.exports = StepBoundaryHandler;