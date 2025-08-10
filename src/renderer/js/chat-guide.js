/**
 * Chat Guide - AI-powered process guidance
 * Helps capture the logic and reasoning behind actions
 */

class ChatGuide {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.quickRepliesContainer = document.getElementById('quick-replies');
        this.chatInput = document.getElementById('chat-input');
        
        this.context = {
            currentStep: null,
            previousSteps: [],
            pendingQuestions: []
        };
        
        this.prompts = {
            action: {
                click: "What does this button/link do? When would you NOT click it?",
                type: "What information are you entering? Where did it come from?",
                copy: "What are you copying? Where will you paste it?",
                paste: "Where did this data come from originally?",
                navigate: "Why are you going to this page? What are you looking for?",
                file: "What type of file is this? What will you do with it?",
                decision: "What are you checking? What are the possible outcomes?",
                wait: "What are you waiting for? How do you know when it's ready?"
            },
            
            logic: {
                condition: "What condition makes you do this?",
                rule: "Can you express this as: IF [condition] THEN [action]?",
                exception: "When would you NOT do this?",
                fallback: "What if this doesn't work or isn't available?",
                validation: "How do you verify this worked correctly?"
            },
            
            data: {
                source: "Where exactly does this data come from?",
                format: "What format is the data in?",
                transformation: "Do you need to change or clean the data?",
                destination: "Where does this data go?",
                validation: "How do you know the data is correct?"
            }
        };
        
        this.initialize();
    }

    /**
     * Initialize chat guide
     */
    initialize() {
        // Welcome message is added in HTML
        
        // Setup quick replies for common responses
        this.setupQuickReplies();
        
        // Setup smart prompting
        this.setupSmartPrompting();
    }

    /**
     * Setup quick reply templates
     */
    setupQuickReplies() {
        this.quickReplyTemplates = {
            dataSource: [
                "Copied from clipboard",
                "From previous step",
                "From email",
                "From file",
                "From another screen",
                "Manually typed",
                "Calculated value"
            ],
            
            decision: [
                "Check if exists",
                "Validate data",
                "Compare values",
                "Check status",
                "Verify permission",
                "Test condition"
            ],
            
            fileType: [
                "Excel (.xlsx)",
                "PDF document",
                "Word document",
                "CSV file",
                "Text file",
                "Image file",
                "Other..."
            ],
            
            errorHandling: [
                "Retry action",
                "Skip and continue",
                "Stop process",
                "Manual intervention",
                "Use fallback",
                "Log and continue"
            ]
        };
    }

    /**
     * Smart prompting based on context
     */
    setupSmartPrompting() {
        // Watch for specific patterns that need follow-up
        this.patterns = {
            credential: /password|login|credential|auth|token|key/i,
            file: /file|document|spreadsheet|excel|pdf|csv/i,
            decision: /if|check|verify|validate|compare|test/i,
            loop: /repeat|each|all|every|multiple|batch/i,
            error: /error|fail|wrong|invalid|missing|cannot/i,
            calculation: /calculate|compute|sum|total|average|count/i
        };
    }

    /**
     * Process activity and generate smart prompt
     */
    processActivity(activity) {
        const prompt = this.generateSmartPrompt(activity);
        
        if (prompt) {
            this.addMessage('ai', prompt.text);
            
            if (prompt.quickReplies) {
                this.showQuickReplies(prompt.quickReplies);
            }
        }
        
        // Store context
        this.context.currentStep = activity;
        this.context.previousSteps.push(activity);
    }

    /**
     * Generate contextual prompt
     */
    generateSmartPrompt(activity) {
        let promptText = "";
        let quickReplies = [];
        
        // Check for specific patterns
        if (activity.type === 'input' && activity.field?.type === 'password') {
            promptText = "I detected a credential field. How should automation handle this?";
            quickReplies = [
                "Prompt for password",
                "Use saved credentials",
                "Environment variable",
                "Single Sign-On"
            ];
        } else if (activity.type === 'file_operation') {
            promptText = `You ${activity.operation} a ${activity.fileType} file. What specific data are you looking for?`;
            quickReplies = [
                "Specific cell/column",
                "Table data",
                "Text pattern",
                "Entire content"
            ];
        } else if (activity.type === 'click' && activity.element?.text?.match(/submit|save|send/i)) {
            promptText = "Before submitting, what validation should occur?";
            quickReplies = [
                "All fields filled",
                "Data is valid",
                "No duplicates",
                "User confirmed",
                "No validation needed"
            ];
        } else if (activity.type === 'app_switch') {
            promptText = `You switched to ${activity.to}. What information are you transferring?`;
            quickReplies = [
                "Copy/paste data",
                "Manual reference",
                "No data transfer",
                "Verification only"
            ];
        } else {
            // Default prompts based on action type
            promptText = this.prompts.action[activity.type] || 
                        "What's the purpose of this action?";
        }
        
        return {
            text: promptText,
            quickReplies: quickReplies.length > 0 ? quickReplies : null
        };
    }

    /**
     * Show quick reply buttons
     */
    showQuickReplies(replies) {
        this.quickRepliesContainer.innerHTML = '';
        
        replies.forEach(reply => {
            const button = document.createElement('button');
            button.className = 'quick-reply';
            button.textContent = reply;
            button.onclick = () => {
                this.handleQuickReply(reply);
            };
            
            this.quickRepliesContainer.appendChild(button);
        });
    }

    /**
     * Handle quick reply selection
     */
    handleQuickReply(reply) {
        // Add as user message
        this.addMessage('user', reply);
        
        // Clear quick replies
        this.quickRepliesContainer.innerHTML = '';
        
        // Process the reply
        this.processReply(reply);
    }

    /**
     * Process user reply
     */
    processReply(reply) {
        // Check if reply needs follow-up
        if (reply.match(this.patterns.file)) {
            this.promptForFileDetails();
        } else if (reply.match(this.patterns.credential)) {
            this.promptForCredentialHandling();
        } else if (reply.match(this.patterns.decision)) {
            this.promptForBranches();
        } else if (reply.match(this.patterns.loop)) {
            this.promptForLoopDetails();
        } else if (reply.match(this.patterns.calculation)) {
            this.promptForCalculationLogic();
        } else {
            // Store the context and move on
            if (this.context.currentStep) {
                this.context.currentStep.userContext = reply;
            }
            
            this.addMessage('ai', "Got it! Continue with your process.");
        }
    }

    /**
     * Prompt for file details
     */
    promptForFileDetails() {
        this.addMessage('ai', "Which specific location in the file?");
        this.showQuickReplies([
            "Cell reference (e.g., B15)",
            "Column name",
            "Row number",
            "Table name",
            "Search for text",
            "Entire file"
        ]);
    }

    /**
     * Prompt for credential handling
     */
    promptForCredentialHandling() {
        this.addMessage('ai', "This credential will be stored as a secure placeholder. How should the automation retrieve it?");
        this.showQuickReplies([
            "Prompt user at runtime",
            "System keyring/vault",
            "Environment variable",
            "Configuration file",
            "SSO/OAuth",
            "API key management"
        ]);
    }

    /**
     * Prompt for decision branches
     */
    promptForBranches() {
        this.addMessage('ai', "What are the possible outcomes of this decision?");
        
        // Create input for branches
        const input = document.createElement('div');
        input.innerHTML = `
            <div style="padding: 10px; background: white; border-radius: 6px; margin: 10px 0;">
                <input type="text" placeholder="If condition 1..." style="width: 100%; margin: 5px 0; padding: 5px;">
                <input type="text" placeholder="If condition 2..." style="width: 100%; margin: 5px 0; padding: 5px;">
                <input type="text" placeholder="Else..." style="width: 100%; margin: 5px 0; padding: 5px;">
                <button onclick="window.chatGuide.captureBranches(this.parentElement)">Add Branches</button>
            </div>
        `;
        
        this.messagesContainer.appendChild(input);
    }

    /**
     * Prompt for loop details
     */
    promptForLoopDetails() {
        this.addMessage('ai', "This sounds like a repeating process. What are you looping through?");
        this.showQuickReplies([
            "Each row in table",
            "Each file in folder",
            "Each item in list",
            "Until condition met",
            "Fixed number of times",
            "While data exists"
        ]);
    }

    /**
     * Prompt for calculation logic
     */
    promptForCalculationLogic() {
        this.addMessage('ai', "What calculation are you performing? Please describe the formula or logic.");
        
        // Add example
        const example = document.createElement('div');
        example.className = 'message ai';
        example.innerHTML = `
            <div class="message-content" style="font-style: italic; opacity: 0.8;">
                Example: "Sum all values in column B where status is 'Active'"
            </div>
        `;
        this.messagesContainer.appendChild(example);
    }

    /**
     * Add message to chat
     */
    addMessage(sender, text) {
        const message = document.createElement('div');
        message.className = `message ${sender}`;
        message.innerHTML = `<div class="message-content">${text}</div>`;
        
        this.messagesContainer.appendChild(message);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        // Animate entrance
        message.style.animation = 'fadeIn 0.3s ease';
    }

    /**
     * Capture branches from input
     */
    captureBranches(container) {
        const inputs = container.querySelectorAll('input');
        const branches = [];
        
        inputs.forEach(input => {
            if (input.value.trim()) {
                branches.push(input.value.trim());
            }
        });
        
        if (branches.length > 0) {
            this.addMessage('user', `Branches: ${branches.join(', ')}`);
            this.addMessage('ai', "Perfect! I've added these branches to your decision node. You can record each path by clicking on the decision node.");
            
            // Remove input container
            container.parentElement.remove();
            
            // Store branches
            if (this.context.currentStep) {
                this.context.currentStep.branches = branches;
            }
        }
    }

    /**
     * Generate contextual help
     */
    getContextualHelp(nodeType) {
        const help = {
            decision: "Click on each branch to record what happens in that scenario. Right-click the node for more options.",
            loop: "Record one iteration, then specify the loop condition. The system will detect the pattern.",
            parallel: "Record each parallel path separately. They'll be shown as simultaneous in the final map.",
            error: "Describe what caused the error and how to handle it. This helps automation recover gracefully."
        };
        
        return help[nodeType] || "Continue recording your process. Press Ctrl+Shift+M to mark important steps.";
    }

    /**
     * Suggest next steps based on context
     */
    suggestNextSteps() {
        const suggestions = [];
        
        // Check for incomplete branches
        const incompleteBranches = this.findIncompleteBranches();
        if (incompleteBranches.length > 0) {
            suggestions.push(`Record branch: ${incompleteBranches[0]}`);
        }
        
        // Check for missing validations
        if (this.context.previousSteps.some(s => s.type === 'submit')) {
            suggestions.push("Add validation before submit");
        }
        
        // Check for missing error handling
        if (!this.context.previousSteps.some(s => s.type === 'error')) {
            suggestions.push("Define error handling");
        }
        
        if (suggestions.length > 0) {
            this.addMessage('ai', `Suggested next steps:`);
            this.showQuickReplies(suggestions);
        }
    }

    /**
     * Find incomplete branches in the process
     */
    findIncompleteBranches() {
        // This would integrate with the process engine
        // For now, return empty
        return [];
    }

    /**
     * Export chat context for documentation
     */
    exportContext() {
        return {
            messages: Array.from(this.messagesContainer.querySelectorAll('.message')).map(m => ({
                sender: m.classList.contains('ai') ? 'ai' : 'user',
                text: m.querySelector('.message-content').textContent
            })),
            context: this.context,
            insights: this.extractInsights()
        };
    }

    /**
     * Extract insights from conversation
     */
    extractInsights() {
        const insights = {
            credentials: [],
            dataSources: [],
            validations: [],
            errorHandling: [],
            businessRules: []
        };
        
        // Parse messages for patterns
        this.context.previousSteps.forEach(step => {
            if (step.credential) {
                insights.credentials.push(step.credential);
            }
            if (step.dataSource) {
                insights.dataSources.push(step.dataSource);
            }
            if (step.validation) {
                insights.validations.push(step.validation);
            }
            if (step.errorHandling) {
                insights.errorHandling.push(step.errorHandling);
            }
            if (step.rule) {
                insights.businessRules.push(step.rule);
            }
        });
        
        return insights;
    }
}

// Initialize chat guide
document.addEventListener('DOMContentLoaded', () => {
    window.chatGuide = new ChatGuide();
    
    // Connect to main app
    if (window.processApp) {
        window.processApp.chat = window.chatGuide;
    }
});