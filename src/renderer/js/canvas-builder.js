/**
 * Canvas Builder - Interactive visual process map
 * Real-time node creation, branching, and navigation
 */

class CanvasBuilder {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.nodesContainer = document.getElementById('nodes-container');
        this.svg = document.getElementById('connections-svg');
        
        this.nodes = new Map();
        this.connections = new Map();
        this.currentNodeId = null;
        this.selectedNodeId = null;
        
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        
        this.layout = new SmartLayout();
        this.animator = new NodeAnimator();
        
        this.setupCanvas();
        this.setupControls();
        this.setupDragAndDrop();
        this.setupMinimap();
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
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.setZoom(this.zoom * 1.2);
        });
        
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.setZoom(this.zoom * 0.8);
        });
        
        document.getElementById('zoom-fit').addEventListener('click', () => {
            this.fitToScreen();
        });
        
        document.getElementById('toggle-minimap').addEventListener('click', () => {
            document.getElementById('minimap').classList.toggle('hidden');
        });
    }

    /**
     * Add a new node to the canvas
     */
    addNode(nodeData) {
        const node = this.createNodeElement(nodeData);
        const position = this.layout.getPositionForNode(nodeData, this.nodes);
        
        node.style.left = position.x + 'px';
        node.style.top = position.y + 'px';
        
        this.nodesContainer.appendChild(node);
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
        
        return node;
    }

    /**
     * Render node content based on type
     */
    renderNodeContent(nodeData) {
        let content = `
            <div class="node-header">
                ${this.getNodeIcon(nodeData.type)} Step ${nodeData.step || '?'}
            </div>
            <div class="node-title">${this.escapeHtml(nodeData.title || nodeData.action?.description || 'Untitled')}</div>
        `;
        
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
            id: branchData.nextNodeId || crypto.randomUUID(),
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
        const viewport = minimap.querySelector('.minimap-viewport');
        
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
        
        document.getElementById('node-count').textContent = `${totalNodes} steps`;
        document.getElementById('branch-count').textContent = `${branches} branches`;
        
        const completion = branches > 0 ? Math.round(recordedBranches / branches * 100) : 100;
        document.getElementById('completion-status').textContent = `${completion}% mapped`;
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

// Add arrow marker to SVG
document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('connections-svg');
    
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
    svg.appendChild(defs);
    
    // Initialize canvas
    window.canvasBuilder = new CanvasBuilder();
});