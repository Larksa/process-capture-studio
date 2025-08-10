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
    try {
      // Try to connect to Chrome DevTools Protocol
      this.browser = await chromium.connectOverCDP('http://localhost:9222');
      this.isConnected = true;
      
      // Get all contexts (browser windows)
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        // Get all pages from first context
        const pages = await contexts[0].pages();
        if (pages.length > 0) {
          this.activePage = pages[0];
        }
      }
      
      console.log('Connected to existing browser via CDP');
      return true;
    } catch (error) {
      console.log('Could not connect to existing browser:', error.message);
      return false;
    }
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
    if (!this.activePage) return null;

    try {
      const element = await this.activePage.evaluate(({ x, y }) => {
        const elem = document.elementFromPoint(x, y);
        if (!elem) return null;

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
      }, { x, y });

      return element;
    } catch (error) {
      console.error('Failed to get element at point:', error);
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
      console.log('New page/tab created:', target.url());
    });

    this.browser.on('targetchanged', async (target) => {
      console.log('Page changed:', target.url());
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