/**
 * Browser Context Worker
 * 
 * Runs as a separate Node.js process to handle Playwright operations
 * without interfering with Electron's main process.
 * Communicates via IPC with the main process.
 */

const BrowserContextService = require('./browser-context-service');

class BrowserContextWorker {
  constructor() {
    this.service = new BrowserContextService();
    this.isInitialized = false;
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  /**
   * Initialize the worker and set up IPC communication
   */
  async init() {
    console.log('[BrowserWorker] Initializing browser context worker...');
    console.log('[BrowserWorker] Process PID:', process.pid);
    console.log('[BrowserWorker] Node version:', process.version);
    
    // Set up IPC message handling
    process.on('message', async (message) => {
      const { id, type, data } = message;
      console.log(`[BrowserWorker] Received message: type=${type}, id=${id}`, data ? `data=${JSON.stringify(data).substring(0, 100)}` : '');
      
      try {
        let result = null;
        
        switch (type) {
          case 'connect':
            console.log('[BrowserWorker] Handling connect request...');
            result = await this.connect();
            break;
            
          case 'disconnect':
            console.log('[BrowserWorker] Handling disconnect request...');
            result = await this.disconnect();
            break;
            
          case 'getElementAtPoint':
            console.log(`[BrowserWorker] Getting element at point: x=${data.x}, y=${data.y}`);
            result = await this.getElementAtPoint(data.x, data.y);
            console.log('[BrowserWorker] Element result:', result ? 'Found element' : 'No element found');
            break;
            
          case 'getPageContext':
            console.log('[BrowserWorker] Getting page context...');
            result = await this.getPageContext();
            console.log('[BrowserWorker] Page context:', result ? `URL: ${result.url}` : 'No context');
            break;
            
          case 'getAllPages':
            result = await this.getAllPages();
            break;
            
          case 'status':
            console.log('[BrowserWorker] Handling status request...');
            result = {
              isConnected: this.service.isConnected,
              hasActivePage: !!this.service.activePage,
              reconnectAttempts: this.reconnectAttempts
            };
            console.log('[BrowserWorker] Status result:', result);
            break;
            
          default:
            throw new Error(`Unknown message type: ${type}`);
        }
        
        // Send success response
        console.log(`[BrowserWorker] Sending response: id=${id}, success=true, hasData=${!!result}`);
        process.send({
          id,
          type: 'response',
          success: true,
          data: result
        });
        
      } catch (error) {
        // Send error response
        console.error(`[BrowserWorker] Sending error response: id=${id}, error=${error.message}`);
        process.send({
          id,
          type: 'response',
          success: false,
          error: error.message
        });
      }
    });
    
    // Handle process termination
    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });
    
    // Auto-connect on startup
    console.log('[BrowserWorker] Attempting auto-connect on startup...');
    try {
      const connectResult = await this.connect();
      console.log('[BrowserWorker] Auto-connect result:', connectResult);
    } catch (error) {
      console.error('[BrowserWorker] Auto-connect failed:', error.message);
      console.error('[BrowserWorker] Stack trace:', error.stack);
    }
    
    console.log('[BrowserWorker] Worker initialized and ready');
  }
  
  /**
   * Connect to browser (existing or launch new)
   */
  async connect() {
    try {
      // First try to connect to existing browser
      console.log('[BrowserWorker] Attempting to connect to existing browser at localhost:9222...');
      const connected = await this.service.connectToExistingBrowser();
      console.log('[BrowserWorker] Connection attempt result:', connected);
      
      if (!connected) {
        console.log('[BrowserWorker] No existing browser found, launching new instance...');
        const launched = await this.service.launchBrowser();
        console.log('[BrowserWorker] Launch attempt result:', launched);
        
        if (!launched) {
          throw new Error('Failed to launch browser');
        }
        
        // Navigate to a blank page for testing
        if (this.service.activePage) {
          console.log('[BrowserWorker] Navigating to about:blank for testing...');
          await this.service.activePage.goto('about:blank');
          console.log('[BrowserWorker] Navigation complete');
        } else {
          console.warn('[BrowserWorker] No active page available after launch');
        }
      }
      
      // Log connection details
      console.log('[BrowserWorker] Service connection status:', {
        isConnected: this.service.isConnected,
        hasActivePage: !!this.service.activePage,
        hasBrowser: !!this.service.browser
      });
      
      this.isInitialized = true;
      this.reconnectAttempts = 0;
      
      // Start monitoring for disconnection
      this.startConnectionMonitoring();
      
      return {
        connected: true,
        mode: connected ? 'existing' : 'launched',
        hasActivePage: !!this.service.activePage
      };
      
    } catch (error) {
      console.error('[BrowserWorker] Connection failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Disconnect from browser
   */
  async disconnect() {
    try {
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
      
      await this.service.disconnect();
      this.isInitialized = false;
      
      return { disconnected: true };
      
    } catch (error) {
      console.error('[BrowserWorker] Disconnect failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get element at specific coordinates
   */
  async getElementAtPoint(x, y) {
    console.log(`[BrowserWorker] getElementAtPoint called with x=${x}, y=${y}`);
    
    if (!this.service.isConnected) {
      console.error('[BrowserWorker] Browser not connected, cannot get element');
      throw new Error('Browser not connected');
    }
    
    if (!this.service.activePage) {
      console.error('[BrowserWorker] No active page available');
      throw new Error('No active page available');
    }
    
    try {
      console.log('[BrowserWorker] Calling service.getElementAtPoint...');
      const element = await this.service.getElementAtPoint(x, y);
      console.log('[BrowserWorker] Element result from service:', element ? 'Element found' : 'No element');
      
      if (!element) {
        console.log('[BrowserWorker] No element found at coordinates');
        return null;
      }
      
      // Log element details
      console.log('[BrowserWorker] Element details:', {
        tag: element.tag,
        hasSelectors: !!element.selectors,
        selector: element.selectors?.css,
        text: element.selectors?.text?.substring(0, 50)
      });
      
      // Also get page context for complete information
      console.log('[BrowserWorker] Getting page context...');
      const pageContext = await this.service.getPageContext();
      console.log('[BrowserWorker] Page context:', pageContext ? `URL: ${pageContext.url}` : 'No context');
      
      return {
        element,
        pageContext,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('[BrowserWorker] Failed to get element:', error.message);
      
      // Try to reconnect if connection was lost
      if (error.message.includes('Target closed') || error.message.includes('Connection closed')) {
        await this.attemptReconnect();
        throw new Error('Connection lost, attempting to reconnect...');
      }
      
      throw error;
    }
  }
  
  /**
   * Get current page context
   */
  async getPageContext() {
    if (!this.service.isConnected) {
      throw new Error('Browser not connected');
    }
    
    return await this.service.getPageContext();
  }
  
  /**
   * Get all open pages
   */
  async getAllPages() {
    if (!this.service.isConnected) {
      throw new Error('Browser not connected');
    }
    
    return await this.service.getAllPages();
  }
  
  /**
   * Monitor connection and attempt reconnection if needed
   */
  startConnectionMonitoring() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    this.reconnectInterval = setInterval(async () => {
      if (!this.service.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.attemptReconnect();
      }
    }, 5000); // Check every 5 seconds
  }
  
  /**
   * Attempt to reconnect to browser
   */
  async attemptReconnect() {
    this.reconnectAttempts++;
    console.log(`[BrowserWorker] Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    try {
      await this.connect();
      console.log('[BrowserWorker] Reconnection successful');
      
      // Notify main process of reconnection
      process.send({
        type: 'event',
        event: 'reconnected',
        data: { attempts: this.reconnectAttempts }
      });
      
    } catch (error) {
      console.error('[BrowserWorker] Reconnection failed:', error.message);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[BrowserWorker] Max reconnection attempts reached');
        
        // Notify main process of failure
        process.send({
          type: 'event',
          event: 'connection_failed',
          data: { attempts: this.reconnectAttempts }
        });
      }
    }
  }
  
  /**
   * Cleanup before exit
   */
  async cleanup() {
    console.log('[BrowserWorker] Cleaning up...');
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    try {
      await this.service.disconnect();
    } catch (error) {
      console.error('[BrowserWorker] Cleanup error:', error.message);
    }
  }
}

// Start the worker
const worker = new BrowserContextWorker();
worker.init().catch(error => {
  console.error('[BrowserWorker] Fatal error:', error);
  process.exit(1);
});

// Keep the process alive
process.stdin.resume();