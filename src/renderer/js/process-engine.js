/**
 * Process Engine - Core data capture and management
 * Captures EVERYTHING needed for automation
 */

// Fallback UUID generator if crypto.randomUUID is not available
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();  // Use the native function
    }
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class ProcessEngine {
    constructor() {
        this.process = {
            id: generateUUID(),
            name: 'Untitled Process',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            nodes: new Map(),
            edges: [],
            currentNodeId: null,
            metadata: {
                author: null,
                description: null,
                tags: [],
                automationReady: false
            }
        };
        
        this.history = [];
        this.redoStack = [];
        this.observers = new Set();
        this.autoSave = false; // Changed to manual save by default
        this.hasUnsavedChanges = false;
        
        this.initializeStorage();
    }

    /**
     * Clear the entire process and start fresh
     */
    clearProcess() {
        this.process = {
            id: generateUUID(),
            name: 'Untitled Process',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            nodes: new Map(),
            edges: [],
            currentNodeId: null,
            metadata: {
                author: null,
                description: null,
                tags: [],
                automationReady: false
            }
        };
        
        this.history = [];
        this.redoStack = [];
        this.hasUnsavedChanges = false; // Reset unsaved changes flag
        
        // Notify observers
        this.notifyObservers('process:cleared', {});
        
        // Clear storage - always clear, not just when autoSave is on
        localStorage.removeItem('process_capture_data');
    }

    /**
     * Create a new process node with complete automation data
     */
    createNode(data) {
        const node = {
            id: data.id || generateUUID(),
            type: data.type || 'action', // action, decision, loop, parallel, merge
            step: this.process.nodes.size + 1,
            
            // Core action data
            action: {
                type: data.actionType, // click, type, navigate, copy, paste, etc.
                description: data.description,
                timestamp: data.timestamp || Date.now()
            },
            
            // UI Element data (for clicks, typing)
            element: data.element ? {
                selector: data.element.selector,
                xpath: data.element.xpath,
                id: data.element.id,
                className: data.element.className,
                tagName: data.element.tagName,
                text: data.element.text,
                attributes: data.element.attributes,
                position: data.element.position, // {x, y} coordinates
                size: data.element.size // {width, height}
            } : null,
            
            // Application context
            context: {
                application: data.application, // 'chrome', 'excel', 'outlook', etc.
                window: data.windowTitle,
                url: data.url,
                filePath: data.filePath,
                processName: data.processName
            },
            
            // Data flow
            dataFlow: {
                input: data.input ? {
                    source: data.input.source, // 'user', 'clipboard', 'file', 'api', 'previous_step'
                    sourceDetails: data.input.sourceDetails,
                    value: data.input.value, // Sanitized/placeholder
                    valueType: data.input.valueType, // 'text', 'number', 'date', 'credential'
                    validation: data.input.validation
                } : null,
                output: data.output ? {
                    destination: data.output.destination,
                    format: data.output.format,
                    storage: data.output.storage
                } : null
            },
            
            // Business logic
            logic: {
                condition: data.condition, // For decision nodes
                reason: data.reason,
                rule: data.rule, // IF-THEN-ELSE rule
                fallback: data.fallback,
                validation: data.validation
            },
            
            // Branches (for decision nodes)
            branches: data.branches ? data.branches.map(b => ({
                id: b.id || generateUUID(),
                condition: b.condition,
                label: b.label,
                probability: b.probability,
                nextNodeId: b.nextNodeId,
                recorded: b.recorded || false
            })) : [],
            
            // Navigation paths
            navigation: data.navigation ? {
                fromPath: data.navigation.fromPath,
                toPath: data.navigation.toPath,
                method: data.navigation.method // 'click', 'keyboard', 'menu', 'direct'
            } : null,
            
            // File operations
            fileOperation: data.fileOperation ? {
                type: data.fileOperation.type, // 'open', 'save', 'read', 'write'
                path: data.fileOperation.path,
                encoding: data.fileOperation.encoding,
                location: data.fileOperation.location // Specific location in file (e.g., Excel cell)
            } : null,
            
            // Credentials (secure placeholders)
            credential: data.credential ? {
                id: data.credential.id,
                type: data.credential.type, // 'password', 'api_key', 'token'
                field: data.credential.field,
                storage: data.credential.storage, // 'prompt', 'keyring', 'env', 'sso'
                placeholder: `CREDENTIAL_${data.credential.id}`
            } : null,
            
            // Timing
            timing: {
                waitBefore: data.waitBefore || 0,
                waitAfter: data.waitAfter || 0,
                timeout: data.timeout || 30000,
                retryCount: data.retryCount || 0,
                retryDelay: data.retryDelay || 1000
            },
            
            // Validation
            validation: {
                preConditions: data.preConditions || [],
                postConditions: data.postConditions || [],
                errorHandling: data.errorHandling || 'stop'
            },
            
            // Visual position (for canvas)
            position: data.position || { x: 0, y: 0 },
            
            // Metadata
            metadata: {
                capturedBy: data.capturedBy || 'manual',
                confidence: data.confidence || 1.0,
                notes: data.notes || '',
                tags: data.tags || [],
                screenshots: data.screenshots || []
            }
        };
        
        this.process.nodes.set(node.id, node);
        this.process.currentNodeId = node.id;
        this.saveToHistory('node_created', node);
        this.notifyObservers('nodeCreated', node);
        
        this.hasUnsavedChanges = true;
        
        if (this.autoSave) {
            this.save();
        }
        
        return node;
    }

    /**
     * Add an edge between nodes
     */
    addEdge(fromId, toId, type = 'normal', condition = null) {
        const edge = {
            id: generateUUID(),
            from: fromId,
            to: toId,
            type: type, // 'normal', 'branch', 'loop', 'error'
            condition: condition,
            label: condition ? this.generateEdgeLabel(condition) : null
        };
        
        this.process.edges.push(edge);
        this.notifyObservers('edgeAdded', edge);
        
        if (this.autoSave) {
            this.save();
        }
        
        return edge;
    }

    /**
     * Add a node (alias for createNode for compatibility)
     */
    addNode(data) {
        console.log('[ProcessEngine] addNode called with:', data);
        const node = this.createNode(data);
        return node ? node.id : null;
    }
    
    /**
     * Mark a node as important
     */
    markNodeAsImportant(nodeId) {
        console.log('[ProcessEngine] markNodeAsImportant called for:', nodeId);
        const node = this.process.nodes.get(nodeId);
        if (!node) return false;
        
        node.metadata.isImportant = true;
        node.metadata.importance = 'high';
        this.notifyObservers('nodeUpdated', node);
        
        if (this.autoSave) {
            this.save();
        }
        
        return true;
    }

    /**
     * Update a node with new data
     */
    updateNode(nodeId, updates) {
        const node = this.process.nodes.get(nodeId);
        if (!node) return null;
        
        // Deep merge updates
        const updatedNode = this.deepMerge(node, updates);
        updatedNode.metadata.lastModified = Date.now();
        
        this.process.nodes.set(nodeId, updatedNode);
        this.saveToHistory('node_updated', { nodeId, updates });
        this.notifyObservers('nodeUpdated', updatedNode);
        
        if (this.autoSave) {
            this.save();
        }
        
        return updatedNode;
    }

    /**
     * Get automation-ready export
     */
    exportForAutomation(format = 'json') {
        console.log('[Export] Starting export process...');
        console.log('[Export] Current nodes count:', this.process.nodes.size);
        console.log('[Export] Nodes map:', this.process.nodes);
        
        // Convert Map to Array properly
        const nodesArray = Array.from(this.process.nodes.values());
        console.log('[Export] Converted nodes array:', nodesArray);
        
        const exportData = {
            process: {
                id: this.process.id,
                name: this.process.name,
                version: this.process.version,
                metadata: this.process.metadata,
                createdAt: this.process.createdAt,
                updatedAt: this.process.updatedAt
            },
            nodes: nodesArray,
            edges: this.process.edges,
            statistics: {
                totalNodes: nodesArray.length,
                totalEdges: this.process.edges.length,
                exportedAt: new Date().toISOString()
            }
        };
        
        console.log('[Export] Export data structure:', exportData);
        
        switch (format) {
            case 'json':
                const jsonString = JSON.stringify(exportData, null, 2);
                console.log('[Export] JSON string length:', jsonString.length);
                return jsonString;
            case 'yaml':
                // TODO: Implement YAML export
                return '# YAML export not yet implemented\n' + JSON.stringify(exportData, null, 2);
            case 'mermaid':
                // TODO: Implement Mermaid export
                return this.generateBasicMermaid();
            case 'playwright':
                return this.generatePlaywrightCode();
            case 'python':
                return this.generatePythonCode();
            case 'documentation':
                return this.generateDocumentation();
            default:
                console.log('[Export] Returning raw export data');
                return JSON.stringify(exportData, null, 2);
        }
    }

    /**
     * Generate basic Mermaid diagram
     */
    generateBasicMermaid() {
        let mermaid = 'graph TD\n';
        const nodes = Array.from(this.process.nodes.values());
        
        if (nodes.length === 0) {
            return 'graph TD\n    A[No steps captured yet]';
        }
        
        nodes.forEach((node, index) => {
            const label = node.description || node.action?.description || `Step ${index + 1}`;
            const sanitizedLabel = label.replace(/"/g, "'");
            mermaid += `    ${node.id}["${sanitizedLabel}"]\n`;
            
            if (index > 0) {
                const prevNode = nodes[index - 1];
                mermaid += `    ${prevNode.id} --> ${node.id}\n`;
            }
        });
        
        return mermaid;
    }
    
    /**
     * Generate Playwright automation code
     */
    generatePlaywrightCode() {
        let code = `// Auto-generated Playwright automation
// Process: ${this.process.name}
// Generated: ${new Date().toISOString()}

const { chromium } = require('playwright');

async function execute${this.toCamelCase(this.process.name)}() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
`;
        
        // Convert nodes to code
        const sortedNodes = this.topologicalSort();
        
        for (const node of sortedNodes) {
            code += this.nodeToPlaywrightCode(node);
        }
        
        code += `
    await browser.close();
}

execute${this.toCamelCase(this.process.name)}().catch(console.error);
`;
        
        return code;
    }

    /**
     * Convert a single node to Playwright code
     */
    nodeToPlaywrightCode(node) {
        let code = `    // Step ${node.step}: ${node.action.description}\n`;
        
        // Add wait if specified
        if (node.timing.waitBefore) {
            code += `    await page.waitForTimeout(${node.timing.waitBefore});\n`;
        }
        
        // Generate action code based on type
        switch (node.action.type) {
            case 'navigate':
                // Use pageContext URL if available, otherwise use context URL
                const url = node.pageContext?.url || node.context?.url || node.action.url;
                if (url) {
                    code += `    await page.goto('${url}');\n`;
                }
                break;
                
            case 'click':
                // Use rich element selectors from Playwright capture
                if (node.element?.selectors) {
                    // Prefer ID selector, then CSS, then XPath
                    const selector = node.element.selectors.id || 
                                   node.element.selectors.css || 
                                   node.element.selectors.xpath;
                    
                    if (selector) {
                        // Add wait for element to be visible
                        code += `    await page.waitForSelector('${selector}', { state: 'visible' });\n`;
                        code += `    await page.click('${selector}');\n`;
                        
                        // Add comment with element text for clarity
                        if (node.element.selectors.text) {
                            code += `    // Clicked: "${node.element.selectors.text}"\n`;
                        }
                    }
                } else if (node.element?.selector) {
                    // Fallback to old selector format
                    code += `    await page.click('${node.element.selector}');\n`;
                } else if (node.position) {
                    // Last resort: use coordinates
                    code += `    // Warning: Using coordinates - selector not available\n`;
                    code += `    await page.mouse.click(${node.position.x}, ${node.position.y});\n`;
                }
                break;
                
            case 'type':
            case 'input':
                if (node.element?.selectors || node.element?.selector) {
                    const selector = node.element.selectors?.id || 
                                   node.element.selectors?.css || 
                                   node.element.selector;
                    
                    if (node.dataFlow?.input) {
                        const value = node.dataFlow.input.valueType === 'credential' 
                            ? `process.env.${node.credential?.placeholder || 'SECRET'}`
                            : `'${node.dataFlow.input.value || ''}'`;
                        
                        code += `    await page.waitForSelector('${selector}', { state: 'visible' });\n`;
                        code += `    await page.fill('${selector}', ${value});\n`;
                    }
                }
                break;
                
            case 'keystroke':
                // Handle keyboard shortcuts
                if (node.key) {
                    const keys = node.key.split('+').map(k => k.trim());
                    code += `    await page.keyboard.press('${keys.join('+').toLowerCase()}');\n`;
                }
                break;
                
            case 'copy':
                if (node.element?.selectors || node.element?.selector) {
                    const selector = node.element.selectors?.id || 
                                   node.element.selectors?.css || 
                                   node.element.selector;
                    code += `    const ${node.id}_value = await page.textContent('${selector}');\n`;
                }
                break;
                
            case 'paste':
                if (node.element?.selectors || node.element?.selector) {
                    const selector = node.element.selectors?.id || 
                                   node.element.selectors?.css || 
                                   node.element.selector;
                    const source = node.dataFlow?.input?.sourceDetails || `${node.id}_clipboard`;
                    code += `    await page.fill('${selector}', ${source});\n`;
                }
                break;
                
            case 'decision':
                code += this.generateDecisionCode(node);
                break;
                
            case 'mark_important':
                code += `    // Important: ${node.action.description || 'User marked this step as important'}\n`;
                break;
        }
        
        // Add validation if specified
        if (node.validation?.postConditions?.length > 0) {
            code += `    // Validate: ${node.validation.postConditions.join(', ')}\n`;
            
            // Generate actual validation code if we have selectors
            for (const condition of node.validation.postConditions) {
                if (condition.includes('visible')) {
                    const selector = node.element?.selectors?.css || node.element?.selector;
                    if (selector) {
                        code += `    await expect(page.locator('${selector}')).toBeVisible();\n`;
                    }
                }
            }
        }
        
        return code + '\n';
    }

    /**
     * Generate decision/branching code
     */
    generateDecisionCode(node) {
        let code = '';
        
        for (let i = 0; i < node.branches.length; i++) {
            const branch = node.branches[i];
            const keyword = i === 0 ? 'if' : 'else if';
            
            code += `    ${keyword} (${branch.condition}) {\n`;
            code += `        // Branch: ${branch.label}\n`;
            
            // Add branch-specific code here
            if (branch.nextNodeId) {
                const nextNode = this.process.nodes.get(branch.nextNodeId);
                if (nextNode) {
                    code += `        ${this.nodeToPlaywrightCode(nextNode)}`;
                }
            }
            
            code += `    }\n`;
        }
        
        return code;
    }

    /**
     * Analyze data flow through the process
     */
    analyzeDataFlow() {
        const dataFlow = {
            inputs: [],
            outputs: [],
            transformations: [],
            dependencies: new Map()
        };
        
        for (const [nodeId, node] of this.process.nodes) {
            // Track inputs
            if (node.dataFlow?.input) {
                dataFlow.inputs.push({
                    nodeId,
                    step: node.step,
                    source: node.dataFlow.input.source,
                    type: node.dataFlow.input.valueType
                });
            }
            
            // Track outputs
            if (node.dataFlow?.output) {
                dataFlow.outputs.push({
                    nodeId,
                    step: node.step,
                    destination: node.dataFlow.output.destination,
                    format: node.dataFlow.output.format
                });
            }
            
            // Track dependencies
            if (node.dataFlow?.input?.source === 'previous_step') {
                const sourceNodeId = node.dataFlow.input.sourceDetails;
                if (!dataFlow.dependencies.has(nodeId)) {
                    dataFlow.dependencies.set(nodeId, []);
                }
                dataFlow.dependencies.get(nodeId).push(sourceNodeId);
            }
        }
        
        return dataFlow;
    }

    /**
     * Extract all credentials for secure handling
     */
    extractCredentials() {
        const credentials = [];
        
        for (const [nodeId, node] of this.process.nodes) {
            if (node.credential) {
                credentials.push({
                    id: node.credential.id,
                    type: node.credential.type,
                    field: node.credential.field,
                    storage: node.credential.storage,
                    placeholder: node.credential.placeholder,
                    usedInStep: node.step
                });
            }
        }
        
        return credentials;
    }

    /**
     * Extract file operations
     */
    extractFileOperations() {
        const files = [];
        
        for (const [nodeId, node] of this.process.nodes) {
            if (node.fileOperation) {
                files.push({
                    step: node.step,
                    operation: node.fileOperation.type,
                    path: node.fileOperation.path,
                    location: node.fileOperation.location
                });
            }
        }
        
        return files;
    }

    /**
     * Extract validation rules
     */
    extractValidationRules() {
        const rules = [];
        
        for (const [nodeId, node] of this.process.nodes) {
            if (node.validation.preConditions.length > 0 || 
                node.validation.postConditions.length > 0) {
                rules.push({
                    step: node.step,
                    pre: node.validation.preConditions,
                    post: node.validation.postConditions,
                    errorHandling: node.validation.errorHandling
                });
            }
        }
        
        return rules;
    }

    /**
     * Generate Python automation code
     */
    generatePythonCode() {
        let code = `#!/usr/bin/env python3
# Auto-generated Python automation
# Process: ${this.process.name}
# Generated: ${new Date().toISOString()}

import time
import pyautogui
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def execute_${this.toCamelCase(this.process.name)}():
    """Execute the captured process"""
    
    # Initialize browser if needed
    driver = None
    
`;
        
        const sortedNodes = this.topologicalSort();
        
        for (const node of sortedNodes) {
            code += this.nodeToPythonCode(node);
        }
        
        code += `
    # Cleanup
    if driver:
        driver.quit()
    
    print("Process completed successfully!")

if __name__ == "__main__":
    execute_${this.toCamelCase(this.process.name)}()
`;
        
        return code;
    }
    
    /**
     * Convert a single node to Python code
     */
    nodeToPythonCode(node) {
        let code = `    # Step ${node.step}: ${node.action.description}\n`;
        
        // Add wait if specified
        if (node.timing.waitBefore) {
            code += `    time.sleep(${node.timing.waitBefore / 1000})\n`;
        }
        
        // Generate action code based on type
        switch (node.action.type) {
            case 'navigate':
                const url = node.pageContext?.url || node.context?.url || node.action.url;
                if (url) {
                    code += `    if not driver:\n`;
                    code += `        driver = webdriver.Chrome()\n`;
                    code += `    driver.get('${url}')\n`;
                }
                break;
                
            case 'click':
                if (node.element?.selectors) {
                    // Use selenium for web elements
                    const selector = node.element.selectors.id || 
                                   node.element.selectors.css || 
                                   node.element.selectors.xpath;
                    
                    if (selector) {
                        code += `    element = WebDriverWait(driver, 10).until(\n`;
                        code += `        EC.element_to_be_clickable((By.CSS_SELECTOR, '${selector}'))\n`;
                        code += `    )\n`;
                        code += `    element.click()\n`;
                        
                        if (node.element.selectors.text) {
                            code += `    # Clicked: "${node.element.selectors.text}"\n`;
                        }
                    }
                } else if (node.position) {
                    // Use pyautogui for desktop clicks
                    code += `    # Click at coordinates\n`;
                    code += `    pyautogui.click(${node.position.x}, ${node.position.y})\n`;
                }
                break;
                
            case 'type':
            case 'input':
                if (node.dataFlow?.input) {
                    const value = node.dataFlow.input.value || '';
                    
                    if (node.element?.selectors) {
                        // Web typing
                        const selector = node.element.selectors?.id || 
                                       node.element.selectors?.css || 
                                       node.element.selector;
                        
                        code += `    element = driver.find_element(By.CSS_SELECTOR, '${selector}')\n`;
                        code += `    element.clear()\n`;
                        code += `    element.send_keys('${value}')\n`;
                    } else {
                        // Desktop typing
                        code += `    pyautogui.typewrite('${value}')\n`;
                    }
                }
                break;
                
            case 'keystroke':
                if (node.key) {
                    const keys = node.key.split('+').map(k => k.trim().toLowerCase());
                    code += `    pyautogui.hotkey(${keys.map(k => `'${k}'`).join(', ')})\n`;
                }
                break;
                
            case 'mark_important':
                code += `    # Important: ${node.action.description || 'User marked this step as important'}\n`;
                break;
        }
        
        return code + '\n';
    }

    /**
     * Generate human-readable documentation
     */
    generateDocumentation() {
        let doc = `# ${this.process.name}\n\n`;
        doc += `## Overview\n${this.process.metadata.description || 'No description provided'}\n\n`;
        doc += `## Process Steps\n\n`;
        
        const sortedNodes = this.topologicalSort();
        
        for (const node of sortedNodes) {
            doc += `### Step ${node.step}: ${node.action.description}\n`;
            
            if (node.logic.reason) {
                doc += `**Why**: ${node.logic.reason}\n`;
            }
            
            if (node.logic.rule) {
                doc += `**Rule**: ${node.logic.rule}\n`;
            }
            
            if (node.type === 'decision') {
                doc += `**Branches**:\n`;
                for (const branch of node.branches) {
                    doc += `- ${branch.label}: ${branch.condition}\n`;
                }
            }
            
            if (node.dataFlow?.input) {
                doc += `**Input**: ${node.dataFlow.input.source} - ${node.dataFlow.input.sourceDetails}\n`;
            }
            
            if (node.dataFlow?.output) {
                doc += `**Output**: ${node.dataFlow.output.destination}\n`;
            }
            
            doc += '\n';
        }
        
        // Add data flow section
        doc += `## Data Flow\n`;
        const dataFlow = this.analyzeDataFlow();
        doc += `- **Inputs**: ${dataFlow.inputs.map(i => i.source).join(', ')}\n`;
        doc += `- **Outputs**: ${dataFlow.outputs.map(o => o.destination).join(', ')}\n`;
        
        // Add credentials section
        const credentials = this.extractCredentials();
        if (credentials.length > 0) {
            doc += `\n## Required Credentials\n`;
            for (const cred of credentials) {
                doc += `- ${cred.type} for ${cred.field} (Step ${cred.usedInStep})\n`;
            }
        }
        
        return doc;
    }

    /**
     * Topological sort for correct execution order
     */
    topologicalSort() {
        const sorted = [];
        const visited = new Set();
        
        const visit = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            
            const node = this.process.nodes.get(nodeId);
            if (!node) return;
            
            // Visit dependencies first
            const edges = this.process.edges.filter(e => e.to === nodeId);
            for (const edge of edges) {
                visit(edge.from);
            }
            
            sorted.push(node);
        };
        
        // Start from nodes with no incoming edges
        for (const [nodeId, node] of this.process.nodes) {
            const hasIncoming = this.process.edges.some(e => e.to === nodeId);
            if (!hasIncoming) {
                visit(nodeId);
            }
        }
        
        // Visit any remaining nodes
        for (const [nodeId] of this.process.nodes) {
            visit(nodeId);
        }
        
        return sorted;
    }

    /**
     * Storage management
     */
    initializeStorage() {
        console.log('🔧 ProcessEngine: Initializing storage...');
        const stored = localStorage.getItem('process_capture_data');
        if (stored) {
            try {
                const dataSize = (stored.length / 1024).toFixed(2);
                console.log(`🔧 ProcessEngine: Found stored data (${dataSize}KB), loading...`);
                
                const data = JSON.parse(stored);
                this.process = data;
                // Convert nodes back to Map
                this.process.nodes = new Map(Object.entries(data.nodes || {}));
                
                console.log(`✅ ProcessEngine: Loaded ${this.process.nodes.size} nodes from storage`);
                console.log(`🔧 ProcessEngine: AutoSave is ${this.autoSave ? 'ENABLED' : 'DISABLED'}`);
            } catch (e) {
                console.error('❌ ProcessEngine: Failed to load stored process:', e);
            }
        } else {
            console.log('🔧 ProcessEngine: No saved data found, starting fresh');
            console.log(`🔧 ProcessEngine: AutoSave is ${this.autoSave ? 'ENABLED' : 'DISABLED'}`);
        }
    }

    save() {
        const data = {
            ...this.process,
            nodes: Object.fromEntries(this.process.nodes)
        };
        localStorage.setItem('process_capture_data', JSON.stringify(data));
        this.process.updatedAt = new Date().toISOString();
        this.hasUnsavedChanges = false;
        this.notifyObservers('process:saved', { timestamp: this.process.updatedAt });
        return true;
    }
    
    /**
     * Manually save the current process
     */
    saveManual() {
        return this.save();
    }
    
    /**
     * Check if there are unsaved changes
     */
    getHasUnsavedChanges() {
        return this.hasUnsavedChanges;
    }

    /**
     * History management
     */
    saveToHistory(action, data) {
        this.history.push({
            action,
            data,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.history.length > 100) {
            this.history.shift();
        }
        
        // Clear redo stack on new action
        this.redoStack = [];
    }

    undo() {
        if (this.history.length === 0) return;
        
        const action = this.history.pop();
        this.redoStack.push(action);
        
        // Implement undo logic based on action type
        // ...
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const action = this.redoStack.pop();
        this.history.push(action);
        
        // Implement redo logic based on action type
        // ...
    }

    /**
     * Observer pattern for UI updates
     */
    subscribe(callback) {
        this.observers.add(callback);
        return () => this.observers.delete(callback);
    }

    notifyObservers(event, data) {
        for (const callback of this.observers) {
            callback(event, data);
        }
    }

    /**
     * Utility functions
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    toCamelCase(str) {
        return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
    }

    toYAML(data) {
        // Simple YAML conversion (for full implementation, use a library)
        return `# Process: ${this.process.name}
version: ${this.process.version}
steps:
${Array.from(this.process.nodes.values()).map(node => `  - step: ${node.step}
    action: ${node.action.description}
    type: ${node.action.type}
    ${node.logic.reason ? `reason: ${node.logic.reason}` : ''}
    ${node.logic.rule ? `rule: ${node.logic.rule}` : ''}`).join('\n')}`;
    }

    toMermaid() {
        let mermaid = 'graph TD\n';
        
        for (const [nodeId, node] of this.process.nodes) {
            const shape = node.type === 'decision' ? `{${node.action.description}}` : `[${node.action.description}]`;
            mermaid += `    ${nodeId}${shape}\n`;
        }
        
        for (const edge of this.process.edges) {
            const label = edge.condition ? `|${edge.condition}|` : '';
            mermaid += `    ${edge.from} -->${label} ${edge.to}\n`;
        }
        
        return mermaid;
    }
}

// Export for use in other modules
window.ProcessEngine = ProcessEngine;