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
            
          case 'saveSession':
            console.log('[BrowserWorker] Handling saveSession request...');
            result = await this.saveSession();
            console.log('[BrowserWorker] Session saved:', result ? 'Success' : 'Failed');
            break;
            
          case 'loadSession':
            console.log('[BrowserWorker] Handling loadSession request...');
            if (!data || !data.sessionState) {
              throw new Error('loadSession requires sessionState data');
            }
            result = await this.loadSession(data.sessionState);
            console.log('[BrowserWorker] Session loaded:', result ? 'Success' : 'Failed');
            break;
            
          case 'refreshSession':
            console.log('[BrowserWorker] Handling refreshSession request...');
            if (!data || !data.sessionState) {
              throw new Error('refreshSession requires sessionState data');
            }
            result = await this.refreshSession(data.sessionState);
            console.log('[BrowserWorker] Session refreshed:', result ? 'Success' : 'Failed');
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
    
    // REMOVED: Auto-connect on startup
    // Browser will only launch when user clicks "Connect Browser"
    // This prevents double browser launch issue
    console.log('[BrowserWorker] Worker ready - waiting for user to click Connect Browser');
    
    console.log('[BrowserWorker] Worker initialized and ready');
  }
  
  /**
   * Connect to browser (existing or launch new)
   */
  async connect() {
    try {
      // Check if already connected
      if (this.service.isConnected && this.service.browser) {
        console.log('[BrowserWorker] Already connected to browser, skipping launch');
        return {
          connected: true,
          mode: 'existing',
          hasActivePage: !!this.service.activePage
        };
      }
      
      // Launch a new Playwright browser instance
      console.log('[BrowserWorker] Launching Playwright browser instance...');
      const launched = await this.service.launchBrowser();
      console.log('[BrowserWorker] Launch attempt result:', launched);
      
      if (!launched) {
        throw new Error('Failed to launch browser');
      }
      
      // Don't navigate anywhere - let the user navigate
      if (this.service.activePage) {
        console.log('[BrowserWorker] Browser ready, waiting for user to navigate...');
        const currentUrl = this.service.activePage.url();
        if (currentUrl && currentUrl !== 'about:blank') {
          console.log('[BrowserWorker] Current page:', currentUrl);
        }
      } else {
        console.warn('[BrowserWorker] No active page available after launch');
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
      
      // Also start health monitoring
      this.startBrowserHealthMonitoring();
      
      return {
        connected: true,
        mode: 'launched',  // Always 'launched' since we removed existing browser connection
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
   * Save the current browser session state
   */
  async saveSession() {
    console.log('[BrowserWorker] saveSession called');
    
    if (!this.service.isConnected) {
      console.error('[BrowserWorker] Browser not connected, cannot save session');
      throw new Error('Browser not connected');
    }
    
    try {
      const sessionState = await this.service.saveSessionState();
      
      if (!sessionState) {
        console.error('[BrowserWorker] Failed to capture session state');
        throw new Error('Failed to capture session state');
      }
      
      console.log('[BrowserWorker] Session captured successfully');
      return sessionState;
      
    } catch (error) {
      console.error('[BrowserWorker] Save session failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Load a saved browser session state
   */
  async loadSession(sessionState) {
    console.log('[BrowserWorker] loadSession called');
    
    if (!this.service.browser) {
      console.error('[BrowserWorker] Browser not available, cannot load session');
      throw new Error('Browser not available');
    }
    
    try {
      const success = await this.service.loadSessionState(sessionState);
      
      if (!success) {
        console.error('[BrowserWorker] Failed to load session state');
        throw new Error('Failed to load session state');
      }
      
      console.log('[BrowserWorker] Session loaded successfully');
      return { loaded: true };
      
    } catch (error) {
      console.error('[BrowserWorker] Load session failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Refresh the current browser session (for mid-replay cookie refresh)
   */
  async refreshSession(sessionState) {
    console.log('[BrowserWorker] refreshSession called');
    
    if (!this.service.browser) {
      console.error('[BrowserWorker] Browser not available, cannot refresh session');
      throw new Error('Browser not available');
    }
    
    try {
      const success = await this.service.refreshSessionState(sessionState);
      
      if (!success) {
        console.error('[BrowserWorker] Failed to refresh session state');
        throw new Error('Failed to refresh session state');
      }
      
      console.log('[BrowserWorker] Session refreshed successfully');
      return { refreshed: true };
      
    } catch (error) {
      console.error('[BrowserWorker] Refresh session failed:', error.message);
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
   * Start browser health monitoring
   */
  startBrowserHealthMonitoring() {
    // Clear any existing monitor
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Check browser health every 5 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        // Check if browser exists and is connected
        if (this.service.browser) {
          const isConnected = this.service.browser.isConnected();
          
          if (!isConnected) {
            console.log('[BrowserWorker] Browser disconnected (likely closed by user)');
            
            // Mark service as disconnected
            this.service.isConnected = false;
            this.service.activePage = null;
            
            // Notify main process
            process.send({
              type: 'event',
              event: 'browser_closed',
              data: { 
                reason: 'Browser window was closed',
                willReconnect: true 
              }
            });
            
            // Attempt to reconnect
            console.log('[BrowserWorker] Attempting to relaunch browser...');
            const launched = await this.service.launchBrowser();
            
            if (launched) {
              console.log('[BrowserWorker] Browser relaunched successfully');
              
              // Notify main process
              process.send({
                type: 'event',
                event: 'browser_reconnected',
                data: {
                  connected: true,
                  mode: 'relaunched',
                  hasActivePage: !!this.service.activePage
                }
              });
            } else {
              console.error('[BrowserWorker] Failed to relaunch browser');
              
              process.send({
                type: 'event',
                event: 'browser_reconnect_failed',
                data: { error: 'Could not relaunch browser' }
              });
            }
          }
        } else if (this.isInitialized && !this.service.browser) {
          // Browser object is gone but we were initialized
          console.log('[BrowserWorker] Browser object lost, attempting recovery...');
          
          const launched = await this.service.launchBrowser();
          if (launched) {
            console.log('[BrowserWorker] Browser recovered');
            
            process.send({
              type: 'event',
              event: 'browser_recovered',
              data: { connected: true }
            });
          }
        }
      } catch (error) {
        console.error('[BrowserWorker] Health check error:', error);
      }
    }, 3000); // Check every 3 seconds for faster recovery
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