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
            type: data.type || 'action', // action, decision, loop, parallel, merge, preparation
            step: this.process.nodes.size + 1,
            
            // Core action data
            action: {
                type: data.actionType, // click, type, navigate, copy, paste, etc.
                description: data.description,
                timestamp: data.timestamp || Date.now()
            },
            
            // Side quest / preparation tracking
            sideQuests: data.sideQuests || [],
            hadPreparationSteps: data.hadPreparationSteps || false,
            
            // UI Element data (for clicks, typing)
            // Enhanced to support CDP-captured element data
            element: (data.element || data.data?.primaryElement) ? (() => {
                const elem = data.element || data.data?.primaryElement;
                return {
                    // Support both old format and new enhanced format from CDP
                    selector: elem.selector || elem.selectors?.css,
                    xpath: elem.xpath || elem.selectors?.xpath,
                    id: elem.id || elem.selectors?.id,
                    name: elem.name,
                    className: elem.className || elem.selectors?.className,
                    tagName: elem.tagName || elem.tag,
                    text: elem.text || elem.selectors?.text,
                    attributes: elem.attributes || elem.selectors?.attributes,
                    position: elem.position, // {x, y} coordinates
                    size: elem.size, // {width, height}
                    // Store all selectors for export flexibility
                    selectors: elem.selectors,
                    // Element type info for forms
                    type: elem.type,
                    value: elem.value,
                    href: elem.href,
                    isClickable: elem.isClickable,
                    isInput: elem.isInput
                };
            })() : null,
            
            // Application context
            // Enhanced with page context from CDP
            context: {
                application: data.application || data.context?.application,
                window: data.windowTitle || data.context?.window,
                url: data.url || data.pageContext?.url || data.data?.primaryPageContext?.url,
                domain: data.pageContext?.domain || data.data?.primaryPageContext?.domain,
                title: data.pageContext?.title || data.data?.primaryPageContext?.title,
                filePath: data.filePath,
                processName: data.processName,
                // Store full page context if available
                pageContext: data.pageContext || data.data?.primaryPageContext
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
            },
            
            // CRITICAL: Preserve the raw data including events array!
            // This contains the actual captured events from Mark Before
            data: data.data || null
        };
        
        // If this is a marked action with events, detect sub-steps
        if (node.type === 'marked-action' && node.data?.events?.length > 0) {
            console.log('[ProcessEngine] Detecting sub-steps for marked action with', node.data.events.length, 'events');
            node.data.subSteps = this.detectSubSteps(node.data.events);
            console.log('[ProcessEngine] Detected', node.data.subSteps.length, 'sub-steps');
        }
        
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
     * Create a preparation branch for side quests
     */
    createPreparationBranch(parentNodeId, sideQuest) {
        console.log('[ProcessEngine] Creating preparation branch for side quest:', sideQuest);
        
        // Create a special preparation node
        const prepNode = {
            id: generateUUID(),
            type: 'preparation',
            action: {
                type: 'preparation',
                description: `Preparation: ${sideQuest.description}`,
                timestamp: sideQuest.startTime
            },
            sideQuests: [sideQuest],
            hadPreparationSteps: true,
            metadata: {
                duration: sideQuest.duration,
                foundWhere: sideQuest.foundWhere,
                foundWhat: sideQuest.foundWhat,
                canBeAutomated: false // Usually manual steps
            }
        };
        
        // Add the preparation node
        this.createNode(prepNode);
        
        // Create edge from parent to preparation node
        if (parentNodeId) {
            this.addEdge(parentNodeId, prepNode.id, {
                type: 'preparation',
                label: 'Gather information'
            });
        }
        
        return prepNode.id;
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
                return this.generateYAMLExport(exportData);
            case 'mermaid':
                return this.generateMermaidDiagram();
            case 'playwright':
                return this.generatePlaywrightCode();
            case 'puppeteer':
                return this.generatePuppeteerCode();
            case 'selenium':
                return this.generateSeleniumCode();
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
     * Generate YAML export
     */
    generateYAMLExport(exportData) {
        let yaml = `# Process Capture Studio Export
# Generated: ${new Date().toISOString()}
# Process: ${this.process.name}

process:
  name: ${this.process.name}
  description: ${this.process.description || 'Captured workflow'}
  created: ${this.process.createdAt}
  version: 1.0.0

metadata:
  captureStarted: ${exportData.metadata?.captureStarted || 'N/A'}
  captureEnded: ${exportData.metadata?.captureEnded || 'N/A'}
  totalActions: ${exportData.nodes?.length || 0}
  hasMarkBefore: ${exportData.metadata?.hasMarkBefore || false}

nodes:
`;
        
        // Add each node
        exportData.nodes?.forEach((node, index) => {
            yaml += `  - step: ${index + 1}\n`;
            yaml += `    type: ${node.type}\n`;
            
            if (node.description) {
                yaml += `    description: "${node.description}"\n`;
            }
            
            if (node.action) {
                yaml += `    action:\n`;
                yaml += `      type: ${node.action.type}\n`;
                if (node.action.description) {
                    yaml += `      description: "${node.action.description}"\n`;
                }
            }
            
            if (node.selector) {
                yaml += `    selector: "${node.selector}"\n`;
            }
            
            if (node.element) {
                yaml += `    element:\n`;
                if (node.element.tagName) yaml += `      tag: ${node.element.tagName}\n`;
                if (node.element.id) yaml += `      id: ${node.element.id}\n`;
                if (node.element.className) yaml += `      class: ${node.element.className}\n`;
                if (node.element.text) yaml += `      text: "${node.element.text.substring(0, 50)}"\n`;
            }
            
            if (node.pageContext) {
                yaml += `    context:\n`;
                if (node.pageContext.url) yaml += `      url: ${node.pageContext.url}\n`;
                if (node.pageContext.title) yaml += `      title: "${node.pageContext.title}"\n`;
            }
            
            if (node.position) {
                yaml += `    position:\n`;
                yaml += `      x: ${node.position.x}\n`;
                yaml += `      y: ${node.position.y}\n`;
            }
            
            if (node.timestamp) {
                yaml += `    timestamp: ${node.timestamp}\n`;
            }
            
            yaml += '\n';
        });
        
        // Add connections/edges if any
        if (exportData.edges && exportData.edges.length > 0) {
            yaml += `edges:\n`;
            exportData.edges.forEach(edge => {
                yaml += `  - from: ${edge.from}\n`;
                yaml += `    to: ${edge.to}\n`;
                if (edge.condition) {
                    yaml += `    condition: "${edge.condition}"\n`;
                }
            });
        }
        
        return yaml;
    }

    /**
     * Generate Mermaid diagram
     */
    generateMermaidDiagram() {
        let mermaid = `graph TD
    %% Process: ${this.process.name}
    %% Generated: ${new Date().toISOString()}
    
`;
        
        const nodes = Array.from(this.process.nodes.values());
        const nodeMap = new Map();
        
        // Create node definitions
        nodes.forEach((node, index) => {
            const nodeId = `N${index}`;
            nodeMap.set(node.id, nodeId);
            
            let label = node.description || node.action?.description || 'Action';
            // Truncate long labels
            if (label.length > 40) {
                label = label.substring(0, 37) + '...';
            }
            
            // Determine node shape based on type
            let shape = '';
            if (node.type === 'marked-action') {
                shape = `${nodeId}[["${label}"]]`; // Double border for marked actions
            } else if (node.type === 'preparation') {
                shape = `${nodeId}{{"${label}"}}`; // Hexagon for preparation
            } else if (node.type === 'decision') {
                shape = `${nodeId}{"${label}"}`; // Diamond for decisions
            } else if (node.type === 'click') {
                shape = `${nodeId}("${label}")`; // Rounded for clicks
            } else {
                shape = `${nodeId}["${label}"]`; // Rectangle for default
            }
            
            mermaid += `    ${shape}\n`;
        });
        
        mermaid += '\n';
        
        // Add connections
        const edges = Array.from(this.process.edges.values());
        edges.forEach(edge => {
            const fromId = nodeMap.get(edge.from);
            const toId = nodeMap.get(edge.to);
            
            if (fromId && toId) {
                if (edge.condition) {
                    mermaid += `    ${fromId} -->|"${edge.condition}"| ${toId}\n`;
                } else {
                    mermaid += `    ${fromId} --> ${toId}\n`;
                }
            }
        });
        
        // Add styling
        mermaid += `
    %% Styling
    classDef marked fill:#f9f,stroke:#333,stroke-width:4px
    classDef preparation fill:#fc9,stroke:#333,stroke-width:2px
    classDef click fill:#9cf,stroke:#333,stroke-width:2px
    classDef decision fill:#ffc,stroke:#333,stroke-width:2px
`;
        
        // Apply styles to nodes
        nodes.forEach((node, index) => {
            const nodeId = `N${index}`;
            if (node.type === 'marked-action') {
                mermaid += `    class ${nodeId} marked\n`;
            } else if (node.type === 'preparation') {
                mermaid += `    class ${nodeId} preparation\n`;
            } else if (node.type === 'click') {
                mermaid += `    class ${nodeId} click\n`;
            } else if (node.type === 'decision') {
                mermaid += `    class ${nodeId} decision\n`;
            }
        });
        
        return mermaid;
    }

    /**
     * Generate Playwright automation code
     */
    generatePlaywrightCode() {
        // Check if there are any preparation steps
        const hasPreparationSteps = Array.from(this.process.nodes.values())
            .some(node => node.hadPreparationSteps || node.type === 'preparation');
        
        let code = `// Auto-generated Playwright automation
// Process: ${this.process.name}
// Generated: ${new Date().toISOString()}
${hasPreparationSteps ? `
// NOTE: This process includes preparation steps that require manual information gathering.
// Before running this automation, ensure you have:` : ''}
`;

        // List all preparation requirements
        if (hasPreparationSteps) {
            const prepSteps = Array.from(this.process.nodes.values())
                .filter(node => node.sideQuests && node.sideQuests.length > 0);
            
            prepSteps.forEach(node => {
                node.sideQuests.forEach(quest => {
                    code += `//   - ${quest.description}\n`;
                });
            });
            code += '\n';
        }

        code += `const { chromium } = require('playwright');

async function execute${this.toCamelCase(this.process.name)}() {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 100  // Slow down actions for visibility
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    // Set default timeout for all actions
    page.setDefaultTimeout(30000);
    
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
     * Get best selector for an element
     */
    getBestSelector(element) {
        if (!element) return null;
        
        // Handle selector string directly (from browser context capture)
        if (typeof element === 'string') {
            return element;
        }
        
        // Priority: ID > data-testid > name > aria-label > CSS > text > XPath
        // Handle both old and new element formats
        if (element?.selectors?.id) {
            return element.selectors.id;
        }
        if (element?.id) {
            return `#${element.id}`;
        }
        
        // Check for data-testid (common in modern apps)
        if (element?.selectors?.attributes?.['data-testid']) {
            return `[data-testid="${element.selectors.attributes['data-testid']}"]`;
        }
        
        if (element?.name) {
            return `[name="${element.name}"]`;
        }
        
        // Check for aria-label (good for accessibility)
        if (element?.selectors?.attributes?.['aria-label']) {
            return `[aria-label="${element.selectors.attributes['aria-label']}"]`;
        }
        
        if (element?.selectors?.css) {
            return element.selectors.css;
        }
        if (element?.selector) {
            return element.selector;
        }
        
        // Use text-based selector for buttons and links
        if (element?.selectors?.text && element?.tagName) {
            const tag = element.tagName.toLowerCase();
            if (tag === 'button' || tag === 'a') {
                return `text="${element.selectors.text}"`;
            }
            return `${tag}:has-text("${element.selectors.text}")`;
        }
        
        if (element?.selectors?.xpath) {
            return `xpath=${element.selectors.xpath}`;
        }
        
        return null;
    }
    
    /**
     * Find previous click event for text input
     */
    findPreviousClick(events, currentEvent) {
        const currentIndex = events.indexOf(currentEvent);
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (events[i].type === 'click' && events[i].element?.isInput) {
                return events[i];
            }
        }
        return null;
    }

    /**
     * Convert a single node to Playwright code
     */
    nodeToPlaywrightCode(node) {
        // Handle preparation nodes
        if (node.type === 'preparation') {
            let code = `    // MANUAL PREPARATION REQUIRED\n`;
            code += `    // ${node.action.description}\n`;
            if (node.metadata) {
                if (node.metadata.foundWhat) {
                    code += `    // Need to find: ${node.metadata.foundWhat}\n`;
                }
                if (node.metadata.foundWhere) {
                    code += `    // Look in: ${node.metadata.foundWhere}\n`;
                }
            }
            code += `    // TODO: Add the required information as a variable or environment variable\n`;
            code += `    const requiredInfo = process.env.REQUIRED_INFO || prompt('Enter required information:');\n\n`;
            return code;
        }
        
        // Handle marked actions with multiple events
        if (node.type === 'marked-action' && node.data?.events) {
            let code = `    // Marked Action: ${node.description}\n`;
            if (node.context) {
                code += `    // Context: ${node.context}\n`;
            }
            
            // Process each event in the marked action
            let lastInputElement = null;
            
            node.data.events.forEach((event, index) => {
                // Add navigation if URL changed
                if (event.pageContext?.url && index === 0) {
                    code += `    await page.goto('${event.pageContext.url}');\n`;
                }
                
                if (event.type === 'click') {
                    const selector = this.getBestSelector(event.element || event.selector);
                    if (selector) {
                        code += `    await page.waitForSelector('${selector}', { state: 'visible', timeout: 10000 });\n`;
                        code += `    await page.click('${selector}');\n`;
                        
                        // Add comment with element text or description
                        const text = event.element?.text || event.element?.selectors?.text || event.text;
                        if (text) {
                            code += `    // Clicked: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"\n`;
                        }
                        
                        // Track if this was an input field click
                        if (event.element?.tagName === 'INPUT' || event.element?.type === 'text' || event.element?.isInput) {
                            lastInputElement = { selector, element: event.element };
                        }
                    } else if (event.x !== undefined && event.y !== undefined) {
                        code += `    // No selector available, using coordinates\n`;
                        code += `    await page.mouse.click(${event.x}, ${event.y});\n`;
                    }
                    
                    // Add small delay after clicks for page interactions
                    code += `    await page.waitForTimeout(500);\n`;
                    
                } else if (event.type === 'typed_text' && event.text) {
                    // Use the last input element if available
                    if (lastInputElement) {
                        const { selector, element } = lastInputElement;
                        
                        // Check if it's a password field
                        if (element?.type === 'password' || element?.name?.toLowerCase().includes('password')) {
                            const envVar = (element.name || 'PASSWORD').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                            code += `    await page.fill('${selector}', process.env.${envVar} || 'your_password');\n`;
                        } else {
                            code += `    await page.fill('${selector}', '${event.text.replace(/'/g, "\\'")}')\n`;
                        }
                        lastInputElement = null; // Reset after use
                    } else {
                        // Type directly if no input field was clicked
                        code += `    await page.keyboard.type('${event.text.replace(/'/g, "\\'")}');\n`;
                    }
                    
                } else if (event.type === 'keystroke' || event.type === 'keydown') {
                    // Handle special keys
                    const key = event.key || event.keyCode;
                    if (key === 'Enter' || key === 13) {
                        code += `    await page.keyboard.press('Enter');\n`;
                        code += `    await page.waitForLoadState('networkidle');\n`;
                    } else if (key === 'Tab' || key === 9) {
                        code += `    await page.keyboard.press('Tab');\n`;
                    } else if (key === 'Escape' || key === 27) {
                        code += `    await page.keyboard.press('Escape');\n`;
                    } else if (typeof key === 'string') {
                        code += `    await page.keyboard.press('${key}');\n`;
                    }
                }
            });
            
            return code + '\n';
        }
        
        // Original handling for single action nodes
        let code = `    // Step ${node.step}: ${node.action.description}\n`;
        
        // Add wait if specified
        if (node.timing?.waitBefore) {
            code += `    await page.waitForTimeout(${node.timing.waitBefore});\n`;
        }
        
        // Generate action code based on type
        switch (node.action?.type) {
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
        // Handle marked actions with multiple events
        if (node.type === 'marked-action' && node.data?.events) {
            let code = `    # Marked Action: ${node.description}\n`;
            if (node.context) {
                code += `    # Context: ${node.context}\n`;
            }
            
            const hasWebContext = node.data.events.some(e => e.pageContext || e.element?.selectors);
            
            node.data.events.forEach(event => {
                if (event.type === 'click') {
                    if (hasWebContext && event.element) {
                        const selector = this.getBestSelector(event.element);
                        if (selector) {
                            // Use Selenium for web elements
                            if (selector.startsWith('#')) {
                                code += `    element = WebDriverWait(driver, 10).until(\n`;
                                code += `        EC.element_to_be_clickable((By.ID, '${selector.substring(1)}'))\n`;
                                code += `    )\n`;
                            } else if (selector.startsWith('[name=')) {
                                const name = selector.match(/\[name="(.+?)"\]/)?.[1];
                                code += `    element = WebDriverWait(driver, 10).until(\n`;
                                code += `        EC.element_to_be_clickable((By.NAME, '${name}'))\n`;
                                code += `    )\n`;
                            } else {
                                code += `    element = WebDriverWait(driver, 10).until(\n`;
                                code += `        EC.element_to_be_clickable((By.CSS_SELECTOR, '${selector}'))\n`;
                                code += `    )\n`;
                            }
                            code += `    element.click()\n`;
                        }
                    } else if (event.position) {
                        // Use pyautogui for desktop clicks
                        code += `    pyautogui.click(${event.position.x}, ${event.position.y})\n`;
                    }
                } else if (event.type === 'typed_text' && event.text) {
                    const prevClick = this.findPreviousClick(node.data.events, event);
                    if (hasWebContext && prevClick?.element) {
                        // Check if password field
                        if (prevClick.element.type === 'password') {
                            const envVar = (prevClick.element.name || 'PASSWORD').toUpperCase();
                            code += `    element.clear()\n`;
                            code += `    element.send_keys(os.environ.get('${envVar}', 'your_password'))\n`;
                        } else {
                            code += `    element.clear()\n`;
                            code += `    element.send_keys('${event.text}')\n`;
                        }
                    } else {
                        code += `    pyautogui.typewrite('${event.text}')\n`;
                    }
                } else if (event.type === 'keystroke' && event.key) {
                    const keys = event.key.toLowerCase().split('+').map(k => k.trim());
                    if (keys.length > 1) {
                        code += `    pyautogui.hotkey(${keys.map(k => `'${k}'`).join(', ')})\n`;
                    } else {
                        code += `    pyautogui.press('${keys[0]}')\n`;
                    }
                }
            });
            
            return code + '\n';
        }
        
        // Original handling for single action nodes
        let code = `    # Step ${node.step}: ${node.action?.description || node.description}\n`;
        
        // Add wait if specified
        if (node.timing?.waitBefore) {
            code += `    time.sleep(${node.timing.waitBefore / 1000})\n`;
        }
        
        // Generate action code based on type
        switch (node.action?.type || node.type) {
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
     * Generate Puppeteer automation code
     */
    generatePuppeteerCode() {
        let code = `// Auto-generated Puppeteer automation
// Process: ${this.process.name}
// Generated: ${new Date().toISOString()}

const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null
    });
    const page = await browser.newPage();
    
`;
        
        const sortedNodes = this.topologicalSort();
        
        for (const node of sortedNodes) {
            code += this.nodeToPuppeteerCode(node);
        }
        
        code += `
    await browser.close();
})();
`;
        
        return code;
    }
    
    /**
     * Convert node to Puppeteer code
     */
    nodeToPuppeteerCode(node) {
        // Handle marked actions with multiple events
        if (node.type === 'marked-action' && node.data?.events) {
            let code = `    // Marked Action: ${node.description}\n`;
            let lastInputElement = null;
            
            node.data.events.forEach((event, index) => {
                if (event.pageContext?.url && index === 0) {
                    code += `    await page.goto('${event.pageContext.url}', { waitUntil: 'networkidle2' });\n`;
                }
                
                if (event.type === 'click') {
                    const selector = this.getBestSelector(event.element || event.selector);
                    if (selector) {
                        code += `    await page.waitForSelector('${selector}', { visible: true });\n`;
                        code += `    await page.click('${selector}');\n`;
                        
                        if (event.element?.tagName === 'INPUT' || event.element?.type === 'text') {
                            lastInputElement = { selector, element: event.element };
                        }
                    } else if (event.x !== undefined && event.y !== undefined) {
                        code += `    await page.mouse.click(${event.x}, ${event.y});\n`;
                    }
                    code += `    await page.waitForTimeout(500);\n`;
                    
                } else if (event.type === 'typed_text' && event.text) {
                    if (lastInputElement) {
                        const { selector, element } = lastInputElement;
                        if (element?.type === 'password') {
                            const envVar = (element.name || 'PASSWORD').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                            code += `    await page.type('${selector}', process.env.${envVar} || 'your_password');\n`;
                        } else {
                            code += `    await page.type('${selector}', '${event.text.replace(/'/g, "\\'")}')\n`;
                        }
                        lastInputElement = null;
                    } else {
                        code += `    await page.keyboard.type('${event.text.replace(/'/g, "\\'")}');\n`;
                    }
                    
                } else if (event.type === 'keystroke' || event.type === 'keydown') {
                    const key = event.key || event.keyCode;
                    if (key === 'Enter' || key === 13) {
                        code += `    await page.keyboard.press('Enter');\n`;
                        code += `    await page.waitForNavigation({ waitUntil: 'networkidle2' });\n`;
                    } else if (typeof key === 'string') {
                        code += `    await page.keyboard.press('${key}');\n`;
                    }
                }
            });
            
            return code + '\n';
        }
        
        // Original single node handling
        return `    // Step ${node.step}: ${node.action?.description || node.description}\n\n`;
    }

    /**
     * Generate Selenium automation code
     */
    generateSeleniumCode() {
        let code = `// Auto-generated Selenium WebDriver code
// Process: ${this.process.name}
// Generated: ${new Date().toISOString()}

const { Builder, By, Key, until } = require('selenium-webdriver');

async function execute${this.toCamelCase(this.process.name)}() {
    let driver = await new Builder().forBrowser('chrome').build();
    
    try {
`;
        
        const sortedNodes = this.topologicalSort();
        
        for (const node of sortedNodes) {
            code += this.nodeToSeleniumCode(node);
        }
        
        code += `
    } finally {
        await driver.quit();
    }
}

execute${this.toCamelCase(this.process.name)}().catch(console.error);
`;
        
        return code;
    }
    
    /**
     * Convert node to Selenium code
     */
    nodeToSeleniumCode(node) {
        // Handle marked actions with multiple events
        if (node.type === 'marked-action' && node.data?.events) {
            let code = `        // Marked Action: ${node.description}\n`;
            let lastInputElement = null;
            
            node.data.events.forEach((event, index) => {
                if (event.pageContext?.url && index === 0) {
                    code += `        await driver.get('${event.pageContext.url}');\n`;
                }
                
                if (event.type === 'click') {
                    const selector = this.getBestSelector(event.element || event.selector);
                    if (selector) {
                        let byMethod = 'css';
                        let selectorValue = selector;
                        
                        if (selector.startsWith('#')) {
                            byMethod = 'id';
                            selectorValue = selector.substring(1);
                        } else if (selector.startsWith('[name=')) {
                            byMethod = 'name';
                            selectorValue = selector.match(/\[name="(.+?)"\]/)?.[1] || selector;
                        } else if (selector.startsWith('xpath=')) {
                            byMethod = 'xpath';
                            selectorValue = selector.substring(6);
                        }
                        
                        code += `        let element = await driver.wait(until.elementLocated(By.${byMethod}('${selectorValue}')), 10000);\n`;
                        code += `        await element.click();\n`;
                        
                        if (event.element?.tagName === 'INPUT' || event.element?.type === 'text') {
                            lastInputElement = { varName: 'element', element: event.element };
                        }
                    }
                    code += `        await driver.sleep(500);\n`;
                    
                } else if (event.type === 'typed_text' && event.text) {
                    if (lastInputElement) {
                        const { element } = lastInputElement;
                        if (element?.type === 'password') {
                            const envVar = (element.name || 'PASSWORD').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                            code += `        await element.clear();\n`;
                            code += `        await element.sendKeys(process.env.${envVar} || 'your_password');\n`;
                        } else {
                            code += `        await element.clear();\n`;
                            code += `        await element.sendKeys('${event.text.replace(/'/g, "\\'")}')\;\n`;
                        }
                        lastInputElement = null;
                    } else {
                        code += `        await driver.actions().sendKeys('${event.text.replace(/'/g, "\\'")}')).perform();\n`;
                    }
                    
                } else if (event.type === 'keystroke' || event.type === 'keydown') {
                    const key = event.key || event.keyCode;
                    if (key === 'Enter' || key === 13) {
                        code += `        await driver.actions().sendKeys(Key.RETURN).perform();\n`;
                        code += `        await driver.sleep(2000);\n`;
                    } else if (typeof key === 'string') {
                        code += `        await driver.actions().sendKeys(Key.${key.toUpperCase()}).perform();\n`;
                    }
                }
            });
            
            return code + '\n';
        }
        
        // Original single node handling
        return `        // Step ${node.step}: ${node.action?.description || node.description}\n\n`;
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
     * Handle activity from ActivityTracker
     * This method processes activities and decides whether to create nodes
     */
    handleActivity(activity) {
        console.log('[ProcessEngine] handleActivity called with:', activity.type);
        
        // Determine if this activity should create a node
        if (this.shouldCreateNode(activity)) {
            // For marked actions, use the full data
            if (activity.type === 'marked-action') {
                return this.addNode(activity);
            }
            
            // For regular activities, create a simple node
            const nodeData = {
                type: activity.type,
                description: activity.description || this.getActivityDescription(activity),
                timestamp: activity.timestamp,
                action: activity,
                element: activity.element || null,
                context: activity.context || null
            };
            
            return this.addNode(nodeData);
        }
        
        // Activity processed but no node created
        return null;
    }
    
    /**
     * Determine if an activity should create a node
     */
    shouldCreateNode(activity) {
        // Always create nodes for marked actions
        if (activity.type === 'marked-action' || activity.type === 'mark_important') {
            return true;
        }
        
        // Create nodes for important activities
        if (activity.isImportant) {
            return true;
        }
        
        // Create nodes for significant actions
        const significantTypes = ['navigation', 'form_submit', 'file_operation', 'decision'];
        if (significantTypes.includes(activity.type)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Detect logical sub-steps from events array
     */
    detectSubSteps(events) {
        if (!events || events.length === 0) return [];
        
        const subSteps = [];
        let currentStep = null;
        let lastEventTime = 0;
        
        events.forEach((event, index) => {
            const timeSinceLastEvent = lastEventTime ? (event.timestamp - lastEventTime) : 0;
            
            // Start new sub-step on:
            // 1. First event
            // 2. Page navigation (URL change)
            // 3. Long pause (>3 seconds)
            // 4. Form submission (Enter after typing)
            // 5. Focus change to different element
            
            let shouldStartNewStep = false;
            let stepName = '';
            
            // First event always starts a step
            if (index === 0) {
                shouldStartNewStep = true;
                stepName = this.getEventDescription(event);
            }
            // Page navigation
            else if (event.pageContext?.url && currentStep?.url !== event.pageContext.url) {
                shouldStartNewStep = true;
                stepName = `Navigate to ${new URL(event.pageContext.url).pathname}`;
            }
            // Long pause suggests new action
            else if (timeSinceLastEvent > 3000) {
                shouldStartNewStep = true;
                stepName = this.getEventDescription(event);
            }
            // Form submission pattern
            else if (event.type === 'keystroke' && event.key === 'Enter' && 
                    currentStep?.events.some(e => e.type === 'typed_text')) {
                shouldStartNewStep = true;
                stepName = 'Submit form';
            }
            
            if (shouldStartNewStep) {
                // Save previous step if exists
                if (currentStep) {
                    subSteps.push(currentStep);
                }
                
                // Start new step
                currentStep = {
                    id: `substep-${subSteps.length + 1}`,
                    name: stepName,
                    startTime: event.timestamp,
                    events: [event],
                    eventIndices: [index],
                    url: event.pageContext?.url,
                    primarySelector: this.extractPrimarySelector(event)
                };
            } else if (currentStep) {
                // Add to current step
                currentStep.events.push(event);
                currentStep.eventIndices.push(index);
                
                // Update step name if we got more meaningful action
                if (event.type === 'typed_text' && currentStep.events.length === 2) {
                    currentStep.name = `Enter "${event.text}" in form`;
                }
            }
            
            lastEventTime = event.timestamp || lastEventTime;
        });
        
        // Add last step
        if (currentStep) {
            currentStep.duration = (lastEventTime - currentStep.startTime) || 0;
            subSteps.push(currentStep);
        }
        
        return subSteps;
    }
    
    /**
     * Get description for a single event
     */
    getEventDescription(event) {
        switch (event.type) {
            case 'click':
                if (event.element?.text) {
                    return `Click "${event.element.text}"`;
                } else if (event.element?.selector) {
                    return `Click ${event.element.selector}`;
                }
                return 'Click element';
                
            case 'typed_text':
                return `Type "${event.text}"`;
                
            case 'keystroke':
                return `Press ${event.key}`;
                
            case 'navigation':
                return `Navigate to ${event.url || 'page'}`;
                
            default:
                return event.description || `${event.type} action`;
        }
    }
    
    /**
     * Extract primary selector from event
     */
    extractPrimarySelector(event) {
        if (event.element?.selectors?.id) {
            return `#${event.element.selectors.id}`;
        }
        if (event.element?.selector) {
            return event.element.selector;
        }
        if (event.element?.selectors?.css) {
            return event.element.selectors.css;
        }
        return null;
    }
    
    /**
     * Get a description for an activity
     */
    getActivityDescription(activity) {
        switch (activity.type) {
            case 'click':
                return `Clicked in ${activity.application || 'application'}`;
            case 'keystroke':
                return `Pressed ${activity.key} in ${activity.application || 'application'}`;
            case 'typed_text':
                return `Typed "${activity.text}" in ${activity.application || 'application'}`;
            case 'navigation':
                return `Navigated to ${activity.url || 'page'}`;
            default:
                return activity.description || `${activity.type} action`;
        }
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