/**
 * Python Bridge - WebSocket server for Python capture service
 * Receives file system and desktop events from Python service
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class PythonBridge extends EventEmitter {
    constructor() {
        super();
        this.wss = null;
        this.pythonClient = null;
        this.isRunning = false;
        this.port = 9876;
        this.captureService = null;
    }

    /**
     * Start WebSocket server to receive Python events
     */
    start(captureService) {
        if (this.isRunning) {
            console.log('🔌 Python bridge already running');
            return;
        }

        this.captureService = captureService;

        try {
            this.wss = new WebSocket.Server({ port: this.port });
            
            this.wss.on('connection', (ws) => {
                console.log('🐍 Python service connected');
                this.pythonClient = ws;
                
                ws.on('message', (data) => {
                    try {
                        const event = JSON.parse(data);
                        this.handlePythonEvent(event);
                    } catch (error) {
                        console.error('Error parsing Python event:', error);
                    }
                });
                
                ws.on('close', () => {
                    console.log('🐍 Python service disconnected');
                    this.pythonClient = null;
                });
                
                ws.on('error', (error) => {
                    console.error('Python WebSocket error:', error);
                });
            });
            
            this.isRunning = true;
            console.log(`🚀 Python bridge listening on port ${this.port}`);
            
        } catch (error) {
            console.error('Failed to start Python bridge:', error);
        }
    }

    /**
     * Handle events from Python service
     */
    handlePythonEvent(event) {
        console.log('📥 Python event:', event.type);
        
        // Transform Python event to match our format
        const captureEvent = this.transformPythonEvent(event);
        
        // Add to capture service buffer if available
        if (this.captureService) {
            this.captureService.addToBuffer(captureEvent);
        }
        
        // Emit for other listeners
        this.emit('python-event', captureEvent);
    }

    /**
     * Transform Python event to our standard format
     */
    transformPythonEvent(pythonEvent) {
        const baseEvent = {
            timestamp: pythonEvent.timestamp || new Date().toISOString(),
            source: 'python',
            platform: pythonEvent.platform || process.platform
        };

        switch (pythonEvent.type) {
            case 'file_moved':
                return {
                    ...baseEvent,
                    type: 'file-operation',
                    action: 'move',
                    sourcePath: pythonEvent.source_path,
                    destPath: pythonEvent.dest_path,
                    filename: pythonEvent.filename,
                    extension: pythonEvent.extension,
                    context: pythonEvent.context,
                    description: `Moved ${pythonEvent.filename} from ${this.getFolder(pythonEvent.source_path)} to ${this.getFolder(pythonEvent.dest_path)}`
                };
            
            case 'file_created':
                return {
                    ...baseEvent,
                    type: 'file-operation',
                    action: 'create',
                    path: pythonEvent.path,
                    filename: pythonEvent.filename,
                    extension: pythonEvent.extension,
                    context: pythonEvent.context,
                    description: `Created ${pythonEvent.filename} in ${this.getFolder(pythonEvent.path)}`
                };
            
            case 'file_deleted':
                return {
                    ...baseEvent,
                    type: 'file-operation',
                    action: 'delete',
                    path: pythonEvent.path,
                    filename: pythonEvent.filename,
                    extension: pythonEvent.extension,
                    description: `Deleted ${pythonEvent.filename} from ${this.getFolder(pythonEvent.path)}`
                };
            
            case 'file_modified':
                return {
                    ...baseEvent,
                    type: 'file-operation',
                    action: 'modify',
                    path: pythonEvent.path,
                    filename: pythonEvent.filename,
                    extension: pythonEvent.extension,
                    size: pythonEvent.size,
                    description: `Modified ${pythonEvent.filename}`
                };
            
            case 'excel_selection':
                // Enhanced Excel capture with actual values
                const valuePreview = pythonEvent.value ? 
                    String(pythonEvent.value).substring(0, 30) : 
                    'Empty';
                return {
                    ...baseEvent,
                    type: 'excel-operation',
                    action: 'select',
                    address: pythonEvent.address,
                    sheet: pythonEvent.sheet,
                    workbook: pythonEvent.workbook,
                    workbookPath: pythonEvent.workbook_path,
                    value: pythonEvent.value,
                    formula: pythonEvent.formula,
                    cells: pythonEvent.cells,  // Array of cell data
                    cellCount: pythonEvent.cell_count,
                    context: pythonEvent.context,
                    description: `📊 Excel: ${pythonEvent.address} = "${valuePreview}" in ${pythonEvent.sheet}`
                };
            
            case 'python_service_connected':
                return {
                    ...baseEvent,
                    type: 'system',
                    action: 'python-connected',
                    capabilities: pythonEvent.capabilities,
                    description: 'Python capture service connected'
                };
            
            case 'clipboard_copy':
                return {
                    ...baseEvent,
                    type: 'clipboard',
                    action: 'copy',
                    content: pythonEvent.content,
                    contentPreview: pythonEvent.content_preview,
                    dataType: pythonEvent.data_type,
                    source: pythonEvent.source,
                    length: pythonEvent.length,
                    description: `📋 Copied ${pythonEvent.data_type}: "${pythonEvent.content_preview}" from ${pythonEvent.source?.application || 'Unknown'}`
                };
            
            default:
                return {
                    ...baseEvent,
                    type: pythonEvent.type,
                    data: pythonEvent,
                    description: `Python event: ${pythonEvent.type}`
                };
        }
    }

    /**
     * Get folder name from full path
     */
    getFolder(path) {
        const parts = path.split(/[/\\]/);
        return parts[parts.length - 2] || 'root';
    }

    /**
     * Send command to Python service
     */
    sendToPython(command) {
        if (this.pythonClient && this.pythonClient.readyState === WebSocket.OPEN) {
            this.pythonClient.send(JSON.stringify(command));
            return true;
        }
        return false;
    }

    /**
     * Stop the Python bridge
     */
    stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        this.pythonClient = null;
        this.isRunning = false;
        console.log('🛑 Python bridge stopped');
    }

    /**
     * Check if Python service is connected
     */
    isConnected() {
        return this.pythonClient && this.pythonClient.readyState === WebSocket.OPEN;
    }
}

module.exports = PythonBridge;