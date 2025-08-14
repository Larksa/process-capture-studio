/**
 * Workflow Analyzer - Detects business process patterns
 * Provides intelligent prompts for common office workflows
 */

class WorkflowAnalyzer {
    constructor() {
        // Business workflow patterns
        this.patterns = {
            // Authentication & Access
            login: {
                indicators: ['username', 'password', 'login', 'sign in', 'email', 'credentials'],
                sequence: ['input[type=text]', 'input[type=password]', 'button'],
                prompts: [
                    "What system are you logging into?",
                    "Is this a daily login or occasional?",
                    "Do you need to handle 2FA or MFA?",
                    "What happens if login fails?"
                ]
            },
            
            // Form Filling
            dataEntry: {
                indicators: ['form', 'input', 'select', 'dropdown', 'checkbox', 'radio'],
                sequence: ['click input', 'type text', 'tab', 'click input', 'type text'],
                prompts: [
                    "Where does this data come from originally?",
                    "Is this data from a spreadsheet, email, or another system?",
                    "How do you know what to enter in each field?",
                    "What validation rules apply to this data?",
                    "How many records do you typically process?"
                ]
            },
            
            // Document Management
            fileOperations: {
                indicators: ['download', 'upload', 'browse', 'file', 'document', 'pdf', 'excel'],
                sequence: ['click download', 'save as'],
                prompts: [
                    "Where do you save these files?",
                    "Do you need to rename the files?",
                    "How often do you download these reports?",
                    "Who else needs access to these files?",
                    "What's the next step after downloading?"
                ]
            },
            
            // Search & Filter
            search: {
                indicators: ['search', 'find', 'filter', 'query', 'lookup'],
                sequence: ['click search', 'type text', 'enter', 'click result'],
                prompts: [
                    "What criteria do you use to find the right record?",
                    "How do you verify you've found the correct item?",
                    "What if no results are found?",
                    "Do you need to search multiple systems?"
                ]
            },
            
            // Approval Workflows
            approval: {
                indicators: ['approve', 'reject', 'review', 'submit', 'confirm'],
                sequence: ['review', 'click approve'],
                prompts: [
                    "What are you checking before approval?",
                    "What are the approval criteria?",
                    "Who gets notified after approval?",
                    "What happens if you reject?",
                    "Is there an escalation process?"
                ]
            },
            
            // Copy-Paste Operations
            copyPaste: {
                indicators: ['copy', 'paste', 'ctrl+c', 'ctrl+v'],
                sequence: ['select text', 'copy', 'navigate', 'paste'],
                prompts: [
                    "What data are you copying?",
                    "Does the format need to change between systems?",
                    "How do you verify the data transferred correctly?",
                    "Are there multiple fields to copy?"
                ]
            },
            
            // Report Generation
            reporting: {
                indicators: ['report', 'export', 'generate', 'dashboard', 'analytics'],
                sequence: ['select date range', 'click generate', 'download'],
                prompts: [
                    "How often do you generate this report?",
                    "What date range do you typically use?",
                    "Who receives this report?",
                    "What format is needed (PDF, Excel, CSV)?",
                    "Are there specific filters you always apply?"
                ]
            },
            
            // Email Workflows
            email: {
                indicators: ['compose', 'send', 'reply', 'forward', 'attach'],
                sequence: ['click compose', 'type subject', 'type body', 'attach', 'send'],
                prompts: [
                    "Is this a standard email template?",
                    "Who are the typical recipients?",
                    "What attachments are usually included?",
                    "Is there a review process before sending?",
                    "How do you track responses?"
                ]
            }
        };
        
        // Business application patterns
        this.applications = {
            salesforce: ['opportunity', 'lead', 'account', 'contact', 'case'],
            sap: ['purchase order', 'invoice', 'vendor', 'material'],
            outlook: ['email', 'calendar', 'meeting', 'appointment'],
            excel: ['spreadsheet', 'worksheet', 'pivot', 'formula'],
            sharepoint: ['document library', 'list', 'workflow'],
            servicenow: ['incident', 'request', 'change', 'problem']
        };
        
        // Sequence detection buffer
        this.recentEvents = [];
        this.maxEventHistory = 20;
    }
    
    /**
     * Analyze events to detect workflow patterns
     */
    analyzeEvents(events) {
        if (!events || events.length === 0) return null;
        
        const detectedPatterns = [];
        
        // Check for pattern matches
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const score = this.calculatePatternScore(events, pattern);
            if (score > 0.5) {
                detectedPatterns.push({
                    name: patternName,
                    confidence: score,
                    pattern: pattern
                });
            }
        }
        
        // Sort by confidence
        detectedPatterns.sort((a, b) => b.confidence - a.confidence);
        
        return detectedPatterns.length > 0 ? detectedPatterns[0] : null;
    }
    
    /**
     * Calculate pattern match score
     */
    calculatePatternScore(events, pattern) {
        let score = 0;
        let matches = 0;
        
        // Check for indicator keywords
        events.forEach(event => {
            // Check in element text
            const elementText = (event.element?.text || event.element?.name || '').toLowerCase();
            const url = (event.pageContext?.url || '').toLowerCase();
            
            pattern.indicators.forEach(indicator => {
                if (elementText.includes(indicator) || url.includes(indicator)) {
                    matches++;
                }
            });
            
            // Check for input types
            if (pattern.indicators.includes('input') && event.element?.tagName === 'INPUT') {
                matches++;
            }
        });
        
        // Calculate score based on matches
        if (pattern.indicators.length > 0) {
            score = matches / (pattern.indicators.length * 2);
        }
        
        return Math.min(score, 1);
    }
    
    /**
     * Get contextual prompt based on detected pattern
     */
    getContextualPrompt(pattern, events) {
        if (!pattern) {
            return this.getGenericPrompt(events);
        }
        
        // Return a relevant prompt from the pattern
        const prompts = pattern.pattern.prompts;
        
        // Try to pick the most relevant prompt based on recent events
        const lastEvent = events[events.length - 1];
        
        // For login patterns, ask about the system
        if (pattern.name === 'login' && prompts.length > 0) {
            return prompts[0];
        }
        
        // For data entry, ask about data source
        if (pattern.name === 'dataEntry' && lastEvent.type === 'typed_text') {
            return prompts[1]; // "Is this data from a spreadsheet, email, or another system?"
        }
        
        // For file operations, ask about file handling
        if (pattern.name === 'fileOperations') {
            return prompts[0]; // "Where do you save these files?"
        }
        
        // Default to first prompt
        return prompts[0];
    }
    
    /**
     * Get generic business-focused prompt
     */
    getGenericPrompt(events) {
        const lastEvent = events[events.length - 1];
        
        if (lastEvent.type === 'click') {
            return "What does this button or link do in your process?";
        }
        
        if (lastEvent.type === 'typed_text') {
            return "Where does this information come from?";
        }
        
        if (lastEvent.type === 'navigation') {
            return "Why are you navigating to this page?";
        }
        
        return "What business task are you completing here?";
    }
    
    /**
     * Detect repetitive patterns that could be automated
     */
    detectRepetitivePatterns(nodes) {
        const patterns = [];
        
        // Look for similar sequences
        for (let i = 0; i < nodes.length - 1; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                if (this.areSimilarNodes(nodes[i], nodes[j])) {
                    patterns.push({
                        type: 'repetitive',
                        firstIndex: i,
                        secondIndex: j,
                        description: nodes[i].description
                    });
                }
            }
        }
        
        return patterns;
    }
    
    /**
     * Check if two nodes represent similar actions
     */
    areSimilarNodes(node1, node2) {
        // Check if descriptions are similar
        if (node1.description === node2.description) {
            return true;
        }
        
        // Check if they have similar event patterns
        const events1 = node1.data?.events || [];
        const events2 = node2.data?.events || [];
        
        if (events1.length !== events2.length) {
            return false;
        }
        
        // Check if event types match
        for (let i = 0; i < events1.length; i++) {
            if (events1[i].type !== events2[i].type) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get quick reply suggestions based on pattern
     */
    getQuickReplies(pattern) {
        const replies = {
            login: [
                "Company portal",
                "CRM system", 
                "Email client",
                "ERP system",
                "Custom application"
            ],
            dataEntry: [
                "From spreadsheet",
                "From email",
                "From PDF document",
                "Manual entry",
                "From another system"
            ],
            fileOperations: [
                "Downloads folder",
                "Shared drive",
                "Desktop",
                "Specific project folder",
                "Email attachment"
            ],
            search: [
                "Customer name",
                "Order number",
                "Date range",
                "Status",
                "ID number"
            ],
            approval: [
                "Approve",
                "Reject with reason",
                "Request more info",
                "Escalate",
                "Defer decision"
            ],
            reporting: [
                "Daily report",
                "Weekly summary",
                "Monthly metrics",
                "Ad-hoc analysis",
                "Compliance report"
            ]
        };
        
        return replies[pattern?.name] || [
            "Continue",
            "Skip this step",
            "Need more context",
            "This varies"
        ];
    }
    
    /**
     * Analyze URL patterns to identify business systems
     */
    identifyBusinessSystem(url) {
        if (!url) return null;
        
        const urlLower = url.toLowerCase();
        
        // Common business systems
        const systems = {
            salesforce: ['salesforce.com', 'force.com', 'lightning'],
            microsoft365: ['office.com', 'sharepoint.com', 'outlook.com', 'teams.microsoft'],
            sap: ['sap.com', 'successfactors', 'ariba'],
            servicenow: ['service-now.com', 'servicenow'],
            workday: ['workday.com', 'myworkday'],
            oracle: ['oracle.com', 'netsuite'],
            google: ['docs.google', 'sheets.google', 'drive.google'],
            jira: ['atlassian.net', 'jira'],
            zendesk: ['zendesk.com'],
            hubspot: ['hubspot.com']
        };
        
        for (const [system, patterns] of Object.entries(systems)) {
            if (patterns.some(pattern => urlLower.includes(pattern))) {
                return system;
            }
        }
        
        return 'custom application';
    }
}

// Export for use in other modules
window.WorkflowAnalyzer = WorkflowAnalyzer;