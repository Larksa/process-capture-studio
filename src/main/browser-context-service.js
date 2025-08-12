/**
 * Browser Context Service
 * Captures full DOM context from running browsers using Chrome DevTools Protocol
 */

const { chromium } = require('playwright');

class BrowserContextService {
  constructor() {
    this.browser = null;
    this.contexts = new Map(); // Store browser contexts by ID
    this.activePage = null;
    this.isConnected = false;
  }

  /**
   * Connect to an existing Chrome/Edge instance via CDP
   * Chrome must be running with --remote-debugging-port=9222
   */
  async connectToExistingBrowser() {
    const addresses = [
      'http://127.0.0.1:9222',  // Try IPv4 first (more common)
      'http://localhost:9222',   // Then localhost (might resolve to IPv6)
      'http://[::1]:9222'        // Finally try IPv6 explicitly
    ];
    
    for (const address of addresses) {
      console.log(`[BrowserService] Attempting CDP connection to ${address}`);
      
      try {
        // Try to connect to Chrome DevTools Protocol
        console.log('[BrowserService] Calling chromium.connectOverCDP...');
        this.browser = await chromium.connectOverCDP(address);
        this.isConnected = true;
        console.log(`[BrowserService] Successfully connected to Chrome via CDP at ${address}`);
      
        // Get all contexts (browser windows)
        const contexts = this.browser.contexts();
        console.log(`[BrowserService] Found ${contexts.length} browser contexts`);
        
        if (contexts.length > 0) {
          // Get all pages from first context
          const pages = await contexts[0].pages();
          console.log(`[BrowserService] Found ${pages.length} pages in first context`);
          
          if (pages.length > 0) {
            this.activePage = pages[0];
            const pageUrl = await this.activePage.url();
            const pageTitle = await this.activePage.title();
            console.log(`[BrowserService] Set active page: URL=${pageUrl}, Title=${pageTitle}`);
            
            // Start monitoring pages
            await this.monitorPages();
            console.log('[BrowserService] Page monitoring started');
          } else {
            console.warn('[BrowserService] No pages found in browser context');
          }
        } else {
          console.warn('[BrowserService] No browser contexts found');
        }
        
        console.log('[BrowserService] Connected to existing browser via CDP successfully');
        return true;
      } catch (error) {
        console.log(`[BrowserService] Failed to connect to ${address}: ${error.message}`);
        // Continue to next address
      }
    }
    
    // If we get here, all connection attempts failed
    console.log('[BrowserService] All CDP connection attempts failed');
    console.log('[BrowserService] Make sure Chrome is running with: --remote-debugging-port=9222');
    this.isConnected = false;
    return false;
  }

  /**
   * Launch a new browser instance for testing/fallback
   */
  async launchBrowser() {
    try {
      this.browser = await chromium.launch({
        headless: false,
        args: ['--remote-debugging-port=9222']
      });
      
      const context = await this.browser.newContext();
      this.activePage = await context.newPage();
      this.isConnected = true;
      
      console.log('Launched new browser instance');
      return true;
    } catch (error) {
      console.error('Failed to launch browser:', error);
      return false;
    }
  }

  /**
   * Get element at specific coordinates
   */
  async getElementAtPoint(x, y) {
    console.log(`[BrowserService] getElementAtPoint called: SCREEN x=${x}, y=${y}`);
    
    if (!this.activePage) {
      console.error('[BrowserService] No active page available');
      return null;
    }

    try {
      // Log page details before evaluation
      const pageUrl = await this.activePage.url();
      console.log(`[BrowserService] Current page URL: ${pageUrl}`);
      
      // Get browser window position for coordinate transformation
      // First, we need to get the browser's actual viewport coordinates
      const browserCoords = await this.activePage.evaluate(() => {
        return {
          screenX: window.screenX,
          screenY: window.screenY,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
          scrollX: window.pageXOffset || window.scrollX,
          scrollY: window.pageYOffset || window.scrollY,
          // Chrome specific - height of browser chrome (URL bar, tabs, etc.)
          chromeHeight: window.outerHeight - window.innerHeight,
          chromeWidth: window.outerWidth - window.innerWidth
        };
      });
      
      console.log('[BrowserService] Browser coordinates:', browserCoords);
      
      // Transform screen coordinates to viewport coordinates
      // Account for browser chrome (toolbar, tabs, etc.)
      const viewportX = x - browserCoords.screenX - (browserCoords.chromeWidth / 2);
      const viewportY = y - browserCoords.screenY - (browserCoords.chromeHeight - browserCoords.chromeWidth / 2);
      
      console.log(`[BrowserService] Transformed coordinates: VIEWPORT x=${viewportX}, y=${viewportY}`);
      
      // Check if coordinates are within viewport
      if (viewportX < 0 || viewportX > browserCoords.innerWidth ||
          viewportY < 0 || viewportY > browserCoords.innerHeight) {
        console.warn('[BrowserService] Coordinates outside viewport bounds');
        console.warn(`[BrowserService] Viewport bounds: 0,0 to ${browserCoords.innerWidth},${browserCoords.innerHeight}`);
      }
      
      console.log('[BrowserService] Executing page.evaluate to find element...');
      const element = await this.activePage.evaluate(({ x, y, scrollX, scrollY }) => {
        // Add scroll offset to get the correct element
        const adjustedX = x + scrollX;
        const adjustedY = y + scrollY;
        
        console.log(`[Browser Console] Looking for element at viewport x=${x}, y=${y}`);
        console.log(`[Browser Console] With scroll offset: x=${adjustedX}, y=${adjustedY}`);
        
        // Try multiple methods to find element
        let elem = document.elementFromPoint(x, y);
        
        if (!elem) {
          // Try with scroll-adjusted coordinates
          elem = document.elementFromPoint(adjustedX, adjustedY);
          if (elem) {
            console.log(`[Browser Console] Found element with scroll adjustment`);
          }
        }
        
        console.log(`[Browser Console] elementFromPoint result:`, elem ? `<${elem.tagName}>` : 'null');
        
        if (!elem) {
          console.log(`[Browser Console] No element found at coordinates`);
          
          // Debug: log what's at various points
          const points = [
            {x: 100, y: 100},
            {x: window.innerWidth/2, y: window.innerHeight/2},
            {x: x, y: y}
          ];
          points.forEach(pt => {
            const el = document.elementFromPoint(pt.x, pt.y);
            if (el) {
              console.log(`[Browser Console] Element at ${pt.x},${pt.y}: <${el.tagName}> ${el.className || ''}`);
            }
          });
          
          return null;
        }

        // Build multiple selector strategies
        const selectors = {
          id: elem.id ? `#${elem.id}` : null,
          className: elem.className ? `.${elem.className.split(' ').join('.')}` : null,
          tagName: elem.tagName.toLowerCase(),
          xpath: null,
          css: null,
          text: elem.textContent?.trim().substring(0, 100),
          attributes: {}
        };

        // Get all attributes
        for (let attr of elem.attributes) {
          selectors.attributes[attr.name] = attr.value;
        }

        // Generate XPath
        function getXPath(element) {
          if (element.id) return `//*[@id="${element.id}"]`;
          
          const parts = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = element.previousSibling;
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && 
                  sibling.nodeName === element.nodeName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            const tagName = element.nodeName.toLowerCase();
            const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
            parts.unshift(part);
            element = element.parentNode;
          }
          return parts.length ? `/${parts.join('/')}` : null;
        }

        selectors.xpath = getXPath(elem);

        // Generate unique CSS selector
        function getCSSSelector(element) {
          const path = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            if (element.id) {
              selector = `#${element.id}`;
              path.unshift(selector);
              break;
            } else if (element.className) {
              selector += `.${element.className.split(' ').join('.')}`;
            }
            path.unshift(selector);
            element = element.parentNode;
          }
          return path.join(' > ');
        }

        selectors.css = getCSSSelector(elem);

        // Get additional context
        const rect = elem.getBoundingClientRect();
        return {
          selectors,
          position: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          tag: elem.tagName.toLowerCase(),
          type: elem.type || null,
          name: elem.name || null,
          value: elem.value || null,
          href: elem.href || null,
          isClickable: elem.onclick !== null || 
                       elem.tagName === 'BUTTON' || 
                       elem.tagName === 'A' ||
                       elem.type === 'submit' ||
                       elem.type === 'button',
          isInput: elem.tagName === 'INPUT' || 
                   elem.tagName === 'TEXTAREA' || 
                   elem.tagName === 'SELECT'
        };
      }, { x: viewportX, y: viewportY, scrollX: browserCoords.scrollX, scrollY: browserCoords.scrollY });

      if (element) {
        console.log('[BrowserService] Element found:', {
          tag: element.tag,
          selector: element.selectors?.css,
          text: element.selectors?.text?.substring(0, 50)
        });
      } else {
        console.log('[BrowserService] No element returned from evaluate');
      }

      return element;
    } catch (error) {
      console.error('[BrowserService] Failed to get element at point:', error.message);
      console.error('[BrowserService] Error stack:', error.stack);
      return null;
    }
  }

  /**
   * Get current page context
   */
  async getPageContext() {
    if (!this.activePage) return null;

    try {
      const context = await this.activePage.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          domain: window.location.hostname,
          path: window.location.pathname,
          hash: window.location.hash,
          search: window.location.search,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          scroll: {
            x: window.scrollX,
            y: window.scrollY
          }
        };
      });

      return context;
    } catch (error) {
      console.error('Failed to get page context:', error);
      return null;
    }
  }

  /**
   * Take screenshot of current page
   */
  async captureScreenshot(options = {}) {
    if (!this.activePage) return null;

    try {
      const screenshot = await this.activePage.screenshot({
        fullPage: options.fullPage || false,
        type: options.type || 'png'
      });
      return screenshot;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      return null;
    }
  }

  /**
   * Monitor for page changes
   */
  async monitorPages() {
    if (!this.browser) return;

    this.browser.on('targetcreated', async (target) => {
      console.log('[BrowserService] New page/tab created:', target.url());
      
      // Update active page if it's a page target
      if (target.type() === 'page') {
        const page = await target.page();
        if (page) {
          this.activePage = page;
          console.log('[BrowserService] Updated active page to new tab');
        }
      }
    });

    this.browser.on('targetchanged', async (target) => {
      console.log('[BrowserService] Page changed:', target.url());
      
      // Update active page reference
      if (target.type() === 'page') {
        const page = await target.page();
        if (page) {
          this.activePage = page;
          console.log('[BrowserService] Updated active page due to navigation');
        }
      }
    });
    
    this.browser.on('targetdestroyed', async (target) => {
      console.log('[BrowserService] Page/tab closed:', target.url());
    });
  }

  /**
   * Get all open pages
   */
  async getAllPages() {
    if (!this.browser) return [];

    try {
      const contexts = this.browser.contexts();
      const allPages = [];
      
      for (const context of contexts) {
        const pages = await context.pages();
        for (const page of pages) {
          allPages.push({
            url: page.url(),
            title: await page.title()
          });
        }
      }
      
      return allPages;
    } catch (error) {
      console.error('Failed to get all pages:', error);
      return [];
    }
  }

  /**
   * Switch to a specific page by URL or title
   */
  async switchToPage(identifier) {
    if (!this.browser) return false;

    try {
      const contexts = this.browser.contexts();
      
      for (const context of contexts) {
        const pages = await context.pages();
        for (const page of pages) {
          const url = page.url();
          const title = await page.title();
          
          if (url.includes(identifier) || title.includes(identifier)) {
            this.activePage = page;
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to switch page:', error);
      return false;
    }
  }

  /**
   * Clean up and disconnect
   */
  async disconnect() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.activePage = null;
      this.isConnected = false;
    }
  }
}

module.exports = BrowserContextService;