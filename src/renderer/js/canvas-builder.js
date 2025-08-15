/**
 * Canvas Builder - Interactive visual process map
 * Real-time node creation, branching, and navigation
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

class CanvasBuilder {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.nodesContainer = document.getElementById('nodes-container');
        this.svg = document.getElementById('connections-svg');
        
        // Check if required elements exist
        if (!this.container) {
            console.error('[CanvasBuilder] canvas-container element not found');
            return;
        }
        if (!this.nodesContainer) {
            console.error('[CanvasBuilder] nodes-container element not found');
            return;
        }
        if (!this.svg) {
            console.error('[CanvasBuilder] connections-svg element not found');
            return;
        }
        
        this.nodes = new Map();
        this.connections = new Map();
        this.currentNodeId = null;
        this.selectedNodeId = null;
        
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        
        this.layout = new SmartLayout();
        this.animator = new NodeAnimator();
        
        // Initialize SVG arrow markers
        this.initializeSVGMarkers();
        
        this.setupCanvas();
        this.setupControls();
        this.setupDragAndDrop();
        this.setupMinimap();
        
        console.log('[CanvasBuilder] Initialized successfully');
        
        // Add a test node to verify rendering (remove in production)
        // this.addTestNode();
    }
    
    /**
     * Add a test node to verify canvas is working
     */
    addTestNode() {
        const testNode = {
            id: 'test-node-1',
            type: 'step',
            title: 'Test Node',
            description: 'This is a test node to verify canvas rendering',
            timestamp: Date.now()
        };
        
        this.addNode(testNode);
        console.log('[Canvas] Test node added');
    }
    
    /**
     * Initialize SVG arrow markers for connections
     */
    initializeSVGMarkers() {
        if (!this.svg) return;
        
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', 'var(--accent-primary)');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.svg.appendChild(defs);
    }

    /**
     * Clear all nodes and connections from the canvas
     */
    clear() {
        console.log('Canvas clear called');
        
        try {
            // Clear all nodes
            this.nodes.clear();
            this.connections.clear();
            this.currentNodeId = null;
            this.selectedNodeId = null;
            
            // Clear DOM elements with null checks
            if (this.nodesContainer && this.nodesContainer.innerHTML !== '') {
                console.log('Clearing nodes container');
                this.nodesContainer.innerHTML = '';
            }
            
            // Clear SVG completely and recreate arrow marker
            if (this.svg) {
                console.log('Clearing SVG connections');
                this.svg.innerHTML = '';
                
                // Re-add arrow marker definition
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                
                marker.setAttribute('id', 'arrowhead');
                marker.setAttribute('markerWidth', '10');
                marker.setAttribute('markerHeight', '10');
                marker.setAttribute('refX', '9');
                marker.setAttribute('refY', '3');
                marker.setAttribute('orient', 'auto');
                
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '0 0, 10 3, 0 6');
                polygon.setAttribute('fill', '#4CAF50');
                
                marker.appendChild(polygon);
                defs.appendChild(marker);
                this.svg.appendChild(defs);
            }
            
            // Reset zoom and pan
            this.zoom = 1;
            this.pan = { x: 0, y: 0 };
            this.updateTransform();
            
            // Update minimap if it exists
            if (this.updateMinimap) {
                this.updateMinimap();
            }
            
            // Force visual refresh with multiple methods
            if (this.nodesContainer) {
                // Method 1: Visibility toggle
                this.nodesContainer.style.visibility = 'hidden';
                this.nodesContainer.offsetHeight; // Force reflow
                this.nodesContainer.style.visibility = 'visible';
                
                // Method 2: Display toggle
                this.nodesContainer.style.display = 'none';
                this.nodesContainer.offsetHeight; // Force reflow
                this.nodesContainer.style.display = 'block';
                
                // Method 3: Remove and re-add to DOM
                const parent = this.nodesContainer.parentNode;
                if (parent) {
                    parent.removeChild(this.nodesContainer);
                    parent.appendChild(this.nodesContainer);
                }
            }
            
            // Force SVG refresh
            if (this.svg) {
                this.svg.style.display = 'none';
                this.svg.offsetHeight; // Force reflow
                this.svg.style.display = 'block';
            }
            
            // Update stats immediately
            this.updateStats();
            
            console.log('Canvas cleared successfully');
        } catch (error) {
            console.error('Error clearing canvas:', error);
            // Try fallback clear method
            this.fallbackClear();
        }
    }

    /**
     * Fallback clear method for when primary clear fails
     */
    fallbackClear() {
        console.log('Using fallback clear method');
        
        try {
            // Force reload the entire canvas container
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                const originalHTML = canvasContainer.innerHTML;
                canvasContainer.innerHTML = '';
                
                // Recreate the basic structure
                canvasContainer.innerHTML = `
                    <svg id="connections-svg" class="connections-layer"></svg>
                    <div id="nodes-container" class="nodes-layer"></div>
                    <div id="minimap" class="minimap hidden">
                        <div class="minimap-viewport"></div>
                    </div>
                `;
                
                // Re-initialize references
                this.nodesContainer = document.getElementById('nodes-container');
                this.svg = document.getElementById('connections-svg');
                
                // Re-add arrow marker
                const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                
                marker.setAttribute('id', 'arrowhead');
                marker.setAttribute('markerWidth', '10');
                marker.setAttribute('markerHeight', '10');
                marker.setAttribute('refX', '9');
                marker.setAttribute('refY', '3');
                marker.setAttribute('orient', 'auto');
                
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', '0 0, 10 3, 0 6');
                polygon.setAttribute('fill', '#4CAF50');
                
                marker.appendChild(polygon);
                defs.appendChild(marker);
                this.svg.appendChild(defs);
                
                // Reset state
                this.nodes.clear();
                this.connections.clear();
                this.currentNodeId = null;
                this.selectedNodeId = null;
                this.zoom = 1;
                this.pan = { x: 0, y: 0 };
                this.updateTransform();
                this.updateStats();
                
                console.log('Fallback clear completed');
            }
        } catch (error) {
            console.error('Fallback clear also failed:', error);
        }
    }

    /**
     * Setup canvas interactions
     */
    setupCanvas() {
        // Pan with mouse drag
        let isPanning = false;
        let startX, startY;
        
        this.container.addEventListener('mousedown', (e) => {
            if (e.target === this.container || e.target === this.svg) {
                isPanning = true;
                startX = e.clientX - this.pan.x;
                startY = e.clientY - this.pan.y;
                this.container.style.cursor = 'grabbing';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isPanning) {
                this.pan.x = e.clientX - startX;
                this.pan.y = e.clientY - startY;
                this.updateTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            isPanning = false;
            this.container.style.cursor = 'grab';
        });
        
        // Zoom with wheel
        this.container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                this.setZoom(this.zoom * delta, e.clientX, e.clientY);
            }
        });
        
        // Right-click context menu
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (e.target.closest('.process-node')) {
                const node = e.target.closest('.process-node');
                this.showNodeMenu(node, e.clientX, e.clientY);
            }
        });
    }

    /**
     * Setup control buttons
     */
    setupControls() {
        // Add null checks for all control elements
        const zoomIn = document.getElementById('zoom-in');
        if (zoomIn) {
            zoomIn.addEventListener('click', () => {
                this.setZoom(this.zoom * 1.2);
            });
        }
        
        const zoomOut = document.getElementById('zoom-out');
        if (zoomOut) {
            zoomOut.addEventListener('click', () => {
                this.setZoom(this.zoom * 0.8);
            });
        }
        
        const zoomFit = document.getElementById('zoom-fit');
        if (zoomFit) {
            zoomFit.addEventListener('click', () => {
                this.fitToScreen();
            });
        }
        
        const toggleMinimap = document.getElementById('toggle-minimap');
        if (toggleMinimap) {
            toggleMinimap.addEventListener('click', () => {
                const minimap = document.getElementById('minimap');
                if (minimap) {
                    minimap.classList.toggle('hidden');
                }
            });
        }
    }

    /**
     * Add a new node to the canvas
     */
    addNode(nodeData) {
        // Check if canvas is properly initialized
        if (!this.nodesContainer || !this.layout) {
            console.error('[Canvas] Cannot add node - canvas not properly initialized');
            return null;
        }
        
        // Only add completed steps to the visual map
        // Step nodes are added when completed, regular nodes are always added
        if (nodeData.type === 'step') {
            console.log('[Canvas] Adding completed step node:', nodeData.title);
        }
        
        const node = this.createNodeElement(nodeData);
        if (!node) {
            console.error('[Canvas] Failed to create node element');
            return null;
        }
        
        const position = this.layout.getPositionForNode(nodeData, this.nodes);
        
        // Log position for debugging
        console.log('[Canvas] Node position:', position);
        
        node.style.left = position.x + 'px';
        node.style.top = position.y + 'px';
        node.style.position = 'absolute'; // Ensure absolute positioning
        
        this.nodesContainer.appendChild(node);
        
        // Verify node was added to DOM
        console.log('[Canvas] Node added to DOM:', node);
        console.log('[Canvas] Node container children:', this.nodesContainer.children.length);
        
        this.nodes.set(nodeData.id, {
            element: node,
            data: nodeData,
            position: position
        });
        
        // Animate entrance
        this.animator.animateNodeEntrance(node);
        
        // Draw connection from previous node
        if (nodeData.previousId) {
            this.drawConnection(nodeData.previousId, nodeData.id);
        }
        
        // Update current node
        if (this.currentNodeId) {
            const prevNode = this.nodes.get(this.currentNodeId);
            if (prevNode) {
                prevNode.element.classList.remove('current');
            }
        }
        
        node.classList.add('current');
        this.currentNodeId = nodeData.id;
        
        // Update stats
        this.updateStats();
        
        // Auto-scroll to new node
        this.scrollToNode(nodeData.id);
        
        return node;
    }

    /**
     * Create node DOM element
     */
    createNodeElement(nodeData) {
        const node = document.createElement('div');
        node.className = `process-node ${nodeData.type}`;
        node.id = `node-${nodeData.id}`;
        node.dataset.nodeId = nodeData.id;
        
        const content = this.renderNodeContent(nodeData);
        node.innerHTML = content;
        
        // Click to select
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(nodeData.id);
        });
        
        // Double-click to edit
        node.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editNode(nodeData.id);
        });
        
        // Right-click context menu
        node.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showNodeContextMenu(nodeData, e.clientX, e.clientY);
        });
        
        return node;
    }

    /**
     * Render node content based on type
     */
    renderNodeContent(nodeData) {
        // Special rendering for step nodes
        if (nodeData.type === 'step') {
            const duration = nodeData.duration ? 
                `${Math.floor(nodeData.duration / 1000)}s` : '';
            const eventCount = nodeData.events ? nodeData.events.length : 0;
            
            return `
                <div class="node-header step-node-header">
                    📋 ${nodeData.title || 'Unnamed Step'}
                </div>
                <div class="node-body">
                    <div class="step-summary">${nodeData.description || 'No description'}</div>
                    <div class="step-stats">
                        <span>${eventCount} actions</span>
                        ${duration ? `<span>${duration}</span>` : ''}
                        ${nodeData.patternType ? `<span class="pattern-badge">${nodeData.patternType}</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        // Original rendering for other node types
        let content = `
            <div class="node-header">
                ${this.getNodeIcon(nodeData.type)} Step ${nodeData.step || '?'}
            </div>
            <div class="node-title">${this.escapeHtml(nodeData.title || nodeData.action?.description || 'Untitled')}</div>
        `;
        
        // Add sub-events for marked actions
        if (nodeData.type === 'marked-action' || nodeData.type === 'grouped_action') {
            content += this.renderSubEvents(nodeData);
        }
        
        if (nodeData.type === 'decision') {
            content += this.renderBranches(nodeData);
        } else if (nodeData.dataFlow) {
            content += this.renderDataFlow(nodeData);
        }
        
        if (nodeData.logic?.reason) {
            content += `<div class="node-details">${this.escapeHtml(nodeData.logic.reason)}</div>`;
        }
        
        return content;
    }
    
    /**
     * Render sub-events for marked actions
     */
    renderSubEvents(nodeData) {
        const events = nodeData.events || nodeData.action?.events || nodeData.data?.events || [];
        
        if (events.length === 0) {
            return '';
        }
        
        let content = '<div class="node-sub-events">';
        
        // Show event count and duration
        if (events.length > 0 || nodeData.duration) {
            content += '<div class="event-summary">';
            if (events.length > 0) {
                content += `<span class="event-count">📊 ${events.length} events</span>`;
            }
            if (nodeData.duration) {
                content += `<span class="event-duration">⏱️ ${(nodeData.duration / 1000).toFixed(1)}s</span>`;
            }
            content += '</div>';
        }
        
        // Show up to 5 events (expandable later)
        const eventsToShow = events.slice(0, 5);
        if (eventsToShow.length > 0) {
            content += '<div class="event-list">';
            eventsToShow.forEach((event, index) => {
                const icon = this.getEventIcon(event.type);
                let eventText = '';
                
                if (event.type === 'click' || event.type === 'mousedown') {
                    const coords = event.coordinates || event.position || { x: event.x, y: event.y };
                    eventText = `Click at (${coords.x}, ${coords.y})`;
                    if (event.element?.selector || event.element?.id) {
                        const selector = event.element.selector || `#${event.element.id}`;
                        eventText += ` on ${selector}`;
                    }
                } else if (event.type === 'keystroke' || event.type === 'typed_text') {
                    const text = event.keys || event.key || event.text || '';
                    if (text.length > 20) {
                        eventText = `Type "${text.substring(0, 20)}..."`;
                    } else {
                        eventText = `Type "${text}"`;
                    }
                } else if (event.type === 'key') {
                    eventText = `Press ${event.key}`;
                } else if (event.type === 'navigation') {
                    eventText = `Navigate to ${event.url || 'page'}`;
                } else {
                    eventText = event.type;
                }
                
                content += `
                    <div class="event-item">
                        <span class="event-index">${index + 1}.</span>
                        <span class="event-icon">${icon}</span>
                        <span class="event-text">${this.escapeHtml(eventText)}</span>
                    </div>
                `;
            });
            
            if (events.length > 5) {
                content += `<div class="event-more">... and ${events.length - 5} more</div>`;
            }
            
            content += '</div>';
        }
        
        content += '</div>';
        return content;
    }
    
    /**
     * Get icon for event type
     */
    getEventIcon(type) {
        const icons = {
            'click': '🖱️',
            'mousedown': '🖱️',
            'mouseup': '🖱️',
            'keystroke': '⌨️',
            'typed_text': '⌨️',
            'key': '⌧',
            'navigation': '🔗',
            'scroll': '📜',
            'file': '📁',
            'copy': '📋',
            'paste': '📋',
            'screenshot': '📸',
            'decision': '🔀',
            'wait': '⏳'
        };
        return icons[type] || '•';
    }

    /**
     * Render decision branches
     */
    renderBranches(nodeData) {
        if (!nodeData.branches || nodeData.branches.length === 0) {
            return '<div class="branches"><em>No branches defined</em></div>';
        }
        
        return `
            <div class="branches">
                ${nodeData.branches.map(branch => `
                    <div class="branch ${branch.recorded ? 'recorded' : 'pending'}" 
                         data-branch-id="${branch.id}">
                        <span class="condition">${this.escapeHtml(branch.condition)}</span>
                        <span class="status">${branch.recorded ? '✓' : '○'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render data flow indicators
     */
    renderDataFlow(nodeData) {
        let flow = '<div class="data-flow">';
        
        if (nodeData.dataFlow?.input) {
            flow += `<span class="data-in">← ${nodeData.dataFlow.input.source}</span>`;
        }
        
        if (nodeData.dataFlow?.output) {
            flow += `<span class="data-out">→ ${nodeData.dataFlow.output.destination}</span>`;
        }
        
        flow += '</div>';
        return flow;
    }

    /**
     * Draw connection between nodes
     */
    drawConnection(fromId, toId, type = 'normal', label = '') {
        const fromNode = this.nodes.get(fromId);
        const toNode = this.nodes.get(toId);
        
        if (!fromNode || !toNode) return;
        
        const connectionId = `${fromId}-${toId}`;
        
        // Remove existing connection if any
        if (this.connections.has(connectionId)) {
            this.connections.get(connectionId).remove();
        }
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.id = `connection-${connectionId}`;
        path.classList.add('connection', type);
        
        // Calculate path
        const pathData = this.calculateConnectionPath(
            fromNode.position,
            toNode.position,
            type
        );
        
        path.setAttribute('d', pathData);
        
        // Add arrow marker
        path.setAttribute('marker-end', 'url(#arrowhead)');
        
        // Add label if provided
        if (label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const midPoint = this.getPathMidpoint(fromNode.position, toNode.position);
            text.setAttribute('x', midPoint.x);
            text.setAttribute('y', midPoint.y - 5);
            text.setAttribute('text-anchor', 'middle');
            text.classList.add('connection-label');
            text.textContent = label;
            this.svg.appendChild(text);
        }
        
        this.svg.appendChild(path);
        this.connections.set(connectionId, path);
        
        // Animate the connection
        this.animator.animateConnection(path);
    }

    /**
     * Calculate connection path (bezier curve)
     */
    calculateConnectionPath(from, to, type) {
        const fromX = from.x + 90; // Center of node
        const fromY = from.y + 40;
        const toX = to.x + 90;
        const toY = to.y;
        
        if (type === 'loop') {
            // Loop back connection
            const cp1x = fromX + 100;
            const cp1y = fromY;
            const cp2x = toX + 100;
            const cp2y = toY;
            
            return `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
        } else {
            // Normal bezier curve
            const dx = toX - fromX;
            const dy = toY - fromY;
            
            const cp1x = fromX + dx * 0.5;
            const cp1y = fromY;
            const cp2x = toX - dx * 0.5;
            const cp2y = toY;
            
            return `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
        }
    }

    /**
     * Select a node
     */
    selectNode(nodeId) {
        // Clear previous selection
        if (this.selectedNodeId) {
            const prevNode = this.nodes.get(this.selectedNodeId);
            if (prevNode) {
                prevNode.element.classList.remove('selected');
            }
        }
        
        const node = this.nodes.get(nodeId);
        if (node) {
            node.element.classList.add('selected');
            this.selectedNodeId = nodeId;
            
            // Notify other components
            if (window.processApp) {
                window.processApp.onNodeSelected(node.data);
            }
        }
    }

    /**
     * Navigate to a node (when clicked from timeline)
     */
    navigateToNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Highlight the path from current to target
        this.highlightPath(this.currentNodeId, nodeId);
        
        // Scroll to node
        this.scrollToNode(nodeId);
        
        // Select the node
        this.selectNode(nodeId);
        
        // Show navigation options
        this.showNavigationOptions(node);
    }

    /**
     * Highlight path between nodes
     */
    highlightPath(fromId, toId) {
        // Clear previous highlights
        document.querySelectorAll('.connection.highlighted').forEach(conn => {
            conn.classList.remove('highlighted');
        });
        
        // Find path between nodes (simple version - enhance with pathfinding)
        const connectionId = `${fromId}-${toId}`;
        const connection = this.connections.get(connectionId);
        
        if (connection) {
            connection.classList.add('highlighted');
            this.animator.pulseElement(connection);
        }
    }

    /**
     * Show navigation options for a node
     */
    showNavigationOptions(node) {
        const menu = document.createElement('div');
        menu.className = 'navigation-menu';
        menu.innerHTML = `
            <button onclick="continueFromNode('${node.data.id}')">
                ↪️ Continue from here
            </button>
            <button onclick="addBranchToNode('${node.data.id}')">
                🔀 Add branch
            </button>
            <button onclick="insertBeforeNode('${node.data.id}')">
                ⬆️ Insert before
            </button>
            <button onclick="insertAfterNode('${node.data.id}')">
                ⬇️ Insert after
            </button>
        `;
        
        node.element.appendChild(menu);
        
        // Remove menu after 5 seconds
        setTimeout(() => menu.remove(), 5000);
    }

    /**
     * Add a branch to a decision node
     */
    addBranch(nodeId, branchData) {
        const node = this.nodes.get(nodeId);
        if (!node || node.data.type !== 'decision') return;
        
        // Update node data
        if (!node.data.branches) {
            node.data.branches = [];
        }
        
        node.data.branches.push(branchData);
        
        // Re-render node
        node.element.innerHTML = this.renderNodeContent(node.data);
        
        // Create new branch node
        const branchNode = {
            id: branchData.nextNodeId || generateUUID(),
            type: 'action',
            title: `${branchData.label} branch`,
            branchOf: nodeId,
            condition: branchData.condition
        };
        
        this.addNode(branchNode);
        this.drawConnection(nodeId, branchNode.id, 'branch', branchData.condition);
    }

    /**
     * Show node context menu
     */
    showNodeMenu(nodeElement, x, y) {
        const menu = document.getElementById('node-menu');
        const nodeId = nodeElement.dataset.nodeId;
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');
        
        // Setup menu actions
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.onclick = () => {
                this.handleNodeAction(nodeId, item.dataset.action);
                menu.classList.add('hidden');
            };
        });
        
        // Hide menu on click outside
        const hideMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', hideMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideMenu);
        }, 0);
    }
    
    /**
     * Show enhanced node context menu with details and replay options
     */
    showNodeContextMenu(nodeData, x, y) {
        // Remove any existing context menu
        const existingMenu = document.getElementById('node-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'node-context-menu';
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 8px 0;
            z-index: 10000;
            min-width: 200px;
        `;
        
        // Menu items based on node type
        const menuItems = [];
        
        // Always show view details
        menuItems.push({ icon: '📋', label: 'View Step Details', action: 'view-details' });
        
        // Show code option if node has events
        if (nodeData.data?.events || nodeData.events) {
            menuItems.push({ icon: '💻', label: 'View Generated Code', action: 'view-code' });
            menuItems.push({ icon: '▶️', label: 'Replay This Step', action: 'replay-step' });
        }
        
        // Standard actions
        menuItems.push(
            { icon: '🌿', label: 'Branch From Here', action: 'branch' },
            { icon: '✏️', label: 'Edit Description', action: 'edit' },
            { icon: '🗑️', label: 'Delete Step', action: 'delete' }
        );
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background 0.2s;
            `;
            menuItem.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = '#f0f0f0';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleEnhancedNodeAction(nodeData, item.action);
                menu.remove();
            });
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Hide menu on click outside
        const hideMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', hideMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideMenu);
        }, 0);
    }
    
    /**
     * Handle enhanced node menu actions
     */
    handleEnhancedNodeAction(nodeData, action) {
        switch (action) {
            case 'view-details':
                this.showStepDetailsModal(nodeData);
                break;
            case 'view-code':
                this.showGeneratedCode(nodeData);
                break;
            case 'replay-step':
                this.replayStep(nodeData);
                break;
            case 'branch':
                this.startBranchRecording(nodeData.id);
                break;
            case 'edit':
                this.editNode(nodeData.id);
                break;
            case 'delete':
                this.deleteNode(nodeData.id);
                break;
        }
    }

    /**
     * Handle node menu actions
     */
    handleNodeAction(nodeId, action) {
        switch (action) {
            case 'continue':
                this.continueFromNode(nodeId);
                break;
            case 'branch':
                this.startBranchRecording(nodeId);
                break;
            case 'edit':
                this.editNode(nodeId);
                break;
            case 'delete':
                this.deleteNode(nodeId);
                break;
            case 'details':
                this.showNodeDetails(nodeId);
                break;
        }
    }

    /**
     * Edit node properties
     */
    editNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Show edit dialog
        if (window.processApp) {
            window.processApp.showEditDialog(node.data);
        }
    }

    /**
     * Delete a node
     */
    deleteNode(nodeId) {
        if (!confirm('Delete this step?')) return;
        
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Remove element
        node.element.remove();
        
        // Remove connections
        this.connections.forEach((conn, id) => {
            if (id.includes(nodeId)) {
                conn.remove();
                this.connections.delete(id);
            }
        });
        
        // Remove from map
        this.nodes.delete(nodeId);
        
        // Update stats
        this.updateStats();
    }

    /**
     * Setup drag and drop for nodes
     */
    setupDragAndDrop() {
        let draggedNode = null;
        let dragOffset = { x: 0, y: 0 };
        
        this.nodesContainer.addEventListener('mousedown', (e) => {
            const node = e.target.closest('.process-node');
            if (!node || e.button !== 0) return;
            
            if (e.shiftKey) {
                // Start dragging
                draggedNode = node;
                const rect = node.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                
                node.style.zIndex = '1000';
                node.style.cursor = 'move';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!draggedNode) return;
            
            const containerRect = this.container.getBoundingClientRect();
            const x = (e.clientX - containerRect.left - dragOffset.x) / this.zoom;
            const y = (e.clientY - containerRect.top - dragOffset.y) / this.zoom;
            
            draggedNode.style.left = x + 'px';
            draggedNode.style.top = y + 'px';
            
            // Update position in data
            const nodeId = draggedNode.dataset.nodeId;
            const node = this.nodes.get(nodeId);
            if (node) {
                node.position = { x, y };
                // Redraw connections
                this.redrawNodeConnections(nodeId);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (draggedNode) {
                draggedNode.style.zIndex = '';
                draggedNode.style.cursor = '';
                draggedNode = null;
            }
        });
    }

    /**
     * Redraw connections for a node
     */
    redrawNodeConnections(nodeId) {
        this.connections.forEach((conn, id) => {
            if (id.includes(nodeId)) {
                const [fromId, toId] = id.split('-');
                conn.remove();
                this.connections.delete(id);
                this.drawConnection(fromId, toId);
            }
        });
    }

    /**
     * Setup minimap
     */
    setupMinimap() {
        const minimap = document.getElementById('minimap');
        if (!minimap) {
            // Minimap not present in this UI, create no-op function
            this.updateMinimap = () => {};
            return;
        }
        
        const viewport = minimap.querySelector('.minimap-viewport');
        if (!viewport) {
            this.updateMinimap = () => {};
            return;
        }
        
        // Update minimap on changes
        this.updateMinimap = () => {
            // Calculate bounds of all nodes
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            this.nodes.forEach(node => {
                const pos = node.position;
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + 180);
                maxY = Math.max(maxY, pos.y + 80);
            });
            
            if (this.nodes.size === 0) return;
            
            const width = maxX - minX;
            const height = maxY - minY;
            
            // Scale to minimap size
            const scale = Math.min(180 / width, 130 / height);
            
            // Update viewport indicator
            const containerRect = this.container.getBoundingClientRect();
            viewport.style.width = (containerRect.width * scale / this.zoom) + 'px';
            viewport.style.height = (containerRect.height * scale / this.zoom) + 'px';
            viewport.style.left = ((-this.pan.x / this.zoom - minX) * scale) + 'px';
            viewport.style.top = ((-this.pan.y / this.zoom - minY) * scale) + 'px';
        };
        
        // Click to navigate
        minimap.addEventListener('click', (e) => {
            const rect = minimap.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            // Calculate pan position
            // (simplified - enhance with proper calculation)
            this.pan.x = -(x * this.container.scrollWidth - this.container.clientWidth / 2);
            this.pan.y = -(y * this.container.scrollHeight - this.container.clientHeight / 2);
            
            this.updateTransform();
        });
    }

    /**
     * Update canvas transform
     */
    updateTransform() {
        this.nodesContainer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
        this.svg.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
        
        if (this.updateMinimap) {
            this.updateMinimap();
        }
    }

    /**
     * Set zoom level
     */
    setZoom(newZoom, centerX, centerY) {
        newZoom = Math.max(0.1, Math.min(3, newZoom));
        
        if (centerX && centerY) {
            // Zoom to point
            const rect = this.container.getBoundingClientRect();
            const x = centerX - rect.left;
            const y = centerY - rect.top;
            
            const scale = newZoom / this.zoom;
            this.pan.x = x - (x - this.pan.x) * scale;
            this.pan.y = y - (y - this.pan.y) * scale;
        }
        
        this.zoom = newZoom;
        this.updateTransform();
    }

    /**
     * Fit all nodes in view
     */
    fitToScreen() {
        if (this.nodes.size === 0) return;
        
        // Calculate bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            const pos = node.position;
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + 180);
            maxY = Math.max(maxY, pos.y + 80);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        const containerRect = this.container.getBoundingClientRect();
        const scaleX = (containerRect.width - 100) / width;
        const scaleY = (containerRect.height - 100) / height;
        
        this.zoom = Math.min(scaleX, scaleY, 1);
        this.pan.x = -minX * this.zoom + 50;
        this.pan.y = -minY * this.zoom + 50;
        
        this.updateTransform();
    }

    /**
     * Scroll to a specific node
     */
    scrollToNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        const containerRect = this.container.getBoundingClientRect();
        const targetX = -node.position.x * this.zoom + containerRect.width / 2 - 90 * this.zoom;
        const targetY = -node.position.y * this.zoom + containerRect.height / 2 - 40 * this.zoom;
        
        // Animate pan
        this.animator.animatePan(this, { x: targetX, y: targetY });
    }

    /**
     * Update statistics
     */
    updateStats() {
        const totalNodes = this.nodes.size;
        const decisionNodes = Array.from(this.nodes.values()).filter(n => n.data.type === 'decision').length;
        const branches = Array.from(this.nodes.values()).reduce((sum, n) => {
            return sum + (n.data.branches?.length || 0);
        }, 0);
        
        const recordedBranches = Array.from(this.nodes.values()).reduce((sum, n) => {
            return sum + (n.data.branches?.filter(b => b.recorded).length || 0);
        }, 0);
        
        // Update modern UI elements
        const statSteps = document.getElementById('stat-steps');
        const statBranches = document.getElementById('stat-branches');
        const statMapped = document.getElementById('stat-mapped');
        
        if (statSteps) {
            statSteps.textContent = totalNodes;
        }
        if (statBranches) {
            statBranches.textContent = branches;
        }
        if (statMapped) {
            const completion = branches > 0 ? Math.round(recordedBranches / branches * 100) : (totalNodes > 0 ? 100 : 0);
            statMapped.textContent = `${completion}%`;
        }
    }

    /**
     * Get path midpoint for label positioning
     */
    getPathMidpoint(from, to) {
        return {
            x: (from.x + to.x) / 2 + 90,
            y: (from.y + to.y) / 2 + 20
        };
    }

    /**
     * Escape HTML for safety
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get node icon based on type
     */
    getNodeIcon(type) {
        const icons = {
            'action': '▶️',
            'decision': '🔀',
            'loop': '🔄',
            'parallel': '⚡',
            'merge': '🔗',
            'error': '⚠️',
            'end': '🏁'
        };
        
        return icons[type] || '📍';
    }
    
    /**
     * Handle updates from ProcessEngine (Observer pattern)
     */
    handleEngineUpdate(event, data) {
        console.log('[Canvas] Received engine update:', event, data);
        
        switch (event) {
            case 'nodeCreated':
                // Add the node to the canvas
                const nodeData = {
                    id: data.id,
                    type: data.type || 'action',
                    title: data.action?.description || data.description || 'Action',
                    subtitle: data.metadata?.notes || '',
                    timestamp: data.timestamp || Date.now(),
                    isImportant: data.metadata?.isImportant || false,
                    previousId: this.currentNodeId
                };
                this.addNode(nodeData);
                console.log('[Canvas] Added node to visual map:', nodeData.id);
                break;
                
            case 'nodeUpdated':
                // Update existing node if needed
                const node = this.nodes.get(data.id);
                if (node) {
                    // Update visual representation if important flag changed
                    if (data.metadata?.isImportant) {
                        node.element.classList.add('important');
                    }
                }
                break;
                
            case 'process:cleared':
                // Clear the canvas
                this.clear();
                break;
        }
    }
    
    /**
     * Show step details modal
     */
    showStepDetailsModal(nodeData) {
        // Remove existing modal if any
        const existingModal = document.getElementById('step-details-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'step-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        // Create modal content
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        `;
        
        // Get events from the node data
        const events = nodeData.data?.events || nodeData.events || [];
        
        content.innerHTML = `
            <h2 style="margin-top: 0;">📋 Step Details</h2>
            <div style="margin-bottom: 16px;">
                <strong>Title:</strong> ${nodeData.title || 'Unnamed Step'}<br>
                <strong>Description:</strong> ${nodeData.description || 'No description'}<br>
                <strong>Duration:</strong> ${nodeData.duration ? (nodeData.duration / 1000).toFixed(1) + 's' : 'N/A'}<br>
                <strong>Events Captured:</strong> ${events.length}
            </div>
            
            <h3>🎯 Captured Events:</h3>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 8px; padding: 12px;">
                ${events.length > 0 ? events.map((event, index) => `
                    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0;">
                        <strong>${index + 1}. ${event.type}</strong>
                        ${event.element?.selector ? `<br><code style="font-size: 11px;">${event.element.selector}</code>` : ''}
                        ${event.element?.text ? `<br>Text: "${event.element.text.substring(0, 50)}"` : ''}
                        ${event.pageContext?.url ? `<br>URL: ${event.pageContext.url}` : ''}
                        ${event.text ? `<br>Typed: "${event.text.substring(0, 50)}"` : ''}
                    </div>
                `).join('') : '<em>No events captured</em>'}
            </div>
            
            ${nodeData.data?.keyElements?.length > 0 ? `
                <h3>🔑 Key Elements:</h3>
                <div style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">
                    ${nodeData.data.keyElements.map(el => `
                        <div style="margin-bottom: 8px;">
                            <strong>${el.type || el.tagName}:</strong> ${el.selector}<br>
                            ${el.text ? `Text: "${el.text}"<br>` : ''}
                            ${el.id ? `ID: ${el.id}<br>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <button id="close-modal" style="
                margin-top: 20px;
                padding: 8px 16px;
                background: var(--accent-primary);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            ">Close</button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close button handler
        document.getElementById('close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * Show generated code for a node
     */
    showGeneratedCode(nodeData) {
        // Get the ProcessEngine instance
        const engine = window.processEngine || window.processApp?.engine;
        if (!engine) {
            alert('Process engine not available');
            return;
        }
        
        // Generate Playwright code for this single node
        const code = engine.stepNodeToPlaywrightCode(nodeData);
        
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        `;
        
        content.innerHTML = `
            <h2 style="margin-top: 0;">💻 Generated Automation Code</h2>
            <p>Playwright code for: <strong>${nodeData.title || 'Step'}</strong></p>
            <pre style="
                background: #f5f5f5;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.5;
            ">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            
            <div style="margin-top: 16px;">
                <button id="copy-code" style="
                    padding: 8px 16px;
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    margin-right: 8px;
                ">📋 Copy Code</button>
                
                <button id="close-code-modal" style="
                    padding: 8px 16px;
                    background: #666;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Copy button handler
        document.getElementById('copy-code').addEventListener('click', () => {
            navigator.clipboard.writeText(code).then(() => {
                const btn = document.getElementById('copy-code');
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = '📋 Copy Code';
                }, 2000);
            });
        });
        
        // Close button handler
        document.getElementById('close-code-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * Replay a single step (placeholder for future implementation)
     */
    replayStep(nodeData) {
        console.log('[Canvas] Replay step requested for:', nodeData);
        
        // This would integrate with Playwright to replay the step
        // For now, show a message
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <h3>▶️ Step Replay</h3>
            <p>Replaying: <strong>${nodeData.title || 'Step'}</strong></p>
            <p style="color: #666;">This feature will execute the captured actions using Playwright.</p>
            <p style="color: #28a745;">Coming soon in the next update!</p>
            <button id="close-replay" style="
                margin-top: 16px;
                padding: 8px 16px;
                background: var(--accent-primary);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            ">OK</button>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('close-replay').addEventListener('click', () => {
            modal.remove();
        });
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            if (document.body.contains(modal)) {
                modal.remove();
            }
        }, 3000);
    }
}

/**
 * Smart layout algorithm for node positioning
 */
class SmartLayout {
    constructor() {
        this.gridSize = 20;
        this.nodeWidth = 180;
        this.nodeHeight = 80;
        this.horizontalSpacing = 250;
        this.verticalSpacing = 120;
        this.branchOffset = 200;
    }

    getPositionForNode(nodeData, existingNodes) {
        // Decision nodes affect layout
        if (nodeData.type === 'decision') {
            return this.getDecisionPosition(nodeData, existingNodes);
        }
        
        // Branch nodes go to the side
        if (nodeData.branchOf) {
            return this.getBranchPosition(nodeData, existingNodes);
        }
        
        // Default linear flow
        return this.getLinearPosition(nodeData, existingNodes);
    }

    getLinearPosition(nodeData, existingNodes) {
        const nodeCount = existingNodes.size;
        const column = nodeCount % 4;
        const row = Math.floor(nodeCount / 4);
        
        // Start with a visible position in the canvas
        const baseX = 100;  // Start 100px from left
        const baseY = 100;  // Start 100px from top
        
        return {
            x: 100 + column * this.horizontalSpacing,
            y: 100 + row * this.verticalSpacing
        };
    }

    getDecisionPosition(nodeData, existingNodes) {
        // Give decision nodes more space
        const lastNode = Array.from(existingNodes.values()).pop();
        
        if (lastNode) {
            return {
                x: lastNode.position.x,
                y: lastNode.position.y + this.verticalSpacing * 1.5
            };
        }
        
        return { x: 400, y: 100 };
    }

    getBranchPosition(nodeData, existingNodes) {
        const parentNode = existingNodes.get(nodeData.branchOf);
        
        if (parentNode) {
            // Calculate branch offset
            const siblingBranches = Array.from(existingNodes.values()).filter(
                n => n.data.branchOf === nodeData.branchOf
            );
            
            const offset = siblingBranches.length * this.branchOffset;
            
            return {
                x: parentNode.position.x + this.branchOffset + offset,
                y: parentNode.position.y + this.verticalSpacing
            };
        }
        
        return { x: 600, y: 200 };
    }
}

/**
 * Node animation controller
 */
class NodeAnimator {
    animateNodeEntrance(node) {
        node.style.opacity = '0';
        node.style.transform = 'scale(0.8)';
        
        requestAnimationFrame(() => {
            node.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            node.style.opacity = '1';
            node.style.transform = 'scale(1)';
        });
    }

    animateConnection(path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        
        requestAnimationFrame(() => {
            path.style.transition = 'stroke-dashoffset 0.5s ease-in-out';
            path.style.strokeDashoffset = '0';
        });
    }

    pulseElement(element) {
        element.style.animation = 'pulse 1s ease-in-out';
        
        setTimeout(() => {
            element.style.animation = '';
        }, 1000);
    }

    animatePan(canvas, target) {
        const start = { ...canvas.pan };
        const duration = 300;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out curve
            const eased = 1 - Math.pow(1 - progress, 3);
            
            canvas.pan.x = start.x + (target.x - start.x) * eased;
            canvas.pan.y = start.y + (target.y - start.y) * eased;
            
            canvas.updateTransform();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Note: Canvas initialization is handled in modern-app.js
// This ensures proper coordination with the ProcessEngine