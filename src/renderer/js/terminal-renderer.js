/**
 * Terminal Renderer - Displays capture activity in terminal style
 * Provides rich, developer-friendly output similar to console logs
 */

class TerminalRenderer {
    constructor(container) {
        this.container = container;
        this.maxLines = 1000;
        this.autoScroll = true;
    }

    /**
     * Format timestamp for terminal display
     */
    formatTime(timestamp) {
        const date = new Date(timestamp || Date.now());
        return date.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    /**
     * Render a capture activity in terminal format
     */
    renderActivity(activity) {
        const time = this.formatTime(activity.timestamp);
        let lines = [];

        switch (activity.type) {
            case 'click':
            case 'mousedown':
            case 'mouseup':
                lines = this.renderClick(activity, time);
                break;
            
            case 'keystroke':
            case 'keydown':
            case 'keyup':
                lines = this.renderKeystroke(activity, time);
                break;
            
            case 'marked-action':
            case 'grouped_action':
                lines = this.renderMarkedAction(activity, time);
                break;
            
            case 'navigation':
                lines = this.renderNavigation(activity, time);
                break;
            
            case 'browser-context':
                lines = this.renderBrowserContext(activity, time);
                break;
            
            default:
                lines = this.renderGeneric(activity, time);
        }

        // Add lines to terminal
        lines.forEach(line => this.addLine(line));
        
        // Auto-scroll to bottom
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    /**
     * Render click activity
     */
    renderClick(activity, time) {
        const lines = [];
        const coords = activity.coordinates || activity.position || { x: activity.x, y: activity.y };
        
        // Main click line
        let mainLine = `[${time}] 🖱️ CLICK at (${coords.x}, ${coords.y})`;
        
        // Add app context if available
        if (activity.application || activity.context?.app) {
            const app = activity.application || activity.context.app;
            mainLine += ` in ${app}`;
        }
        
        lines.push({ text: mainLine, className: 'click' });
        
        // Add URL if available
        if (activity.context?.url || activity.browserContext?.url || activity.pageContext?.url) {
            const url = activity.context?.url || activity.browserContext?.url || activity.pageContext?.url;
            lines.push({ 
                text: `           URL: ${url}`, 
                className: 'terminal-element' 
            });
        }
        
        // Add element info if available
        if (activity.element) {
            const elem = activity.element;
            
            // Element HTML
            if (elem.tagName || elem.text) {
                const tag = elem.tagName || 'element';
                const text = elem.text ? elem.text.substring(0, 50) : '';
                lines.push({ 
                    text: `           Element: <${tag.toLowerCase()}>${text}</${tag.toLowerCase()}>`, 
                    className: 'terminal-element' 
                });
            }
            
            // Selector info
            if (elem.selector || elem.id || elem.selectors?.css) {
                const selector = elem.selector || (elem.id ? `#${elem.id}` : elem.selectors?.css);
                lines.push({ 
                    text: `           Selector: ${selector}`, 
                    className: 'terminal-element terminal-selector' 
                });
            }
            
            // XPath if available
            if (elem.xpath || elem.selectors?.xpath) {
                const xpath = elem.xpath || elem.selectors.xpath;
                lines.push({ 
                    text: `           XPath: ${xpath}`, 
                    className: 'terminal-element' 
                });
            }
        }
        
        return lines;
    }

    /**
     * Render keystroke activity
     */
    renderKeystroke(activity, time) {
        const lines = [];
        const key = activity.key || activity.keys || activity.data;
        
        // Determine if it's typing or a special key
        const isTyping = key && key.length > 1 && !key.includes('cmd') && !key.includes('ctrl') && !key.includes('alt');
        
        let mainLine = `[${time}] ⌨️ `;
        
        if (isTyping) {
            mainLine += `TYPE "${key}"`;
        } else {
            mainLine += `KEY ${key}`;
        }
        
        // Add app context
        if (activity.application || activity.context?.app) {
            const app = activity.application || activity.context.app;
            mainLine += ` in ${app}`;
        }
        
        lines.push({ text: mainLine, className: 'keystroke' });
        
        // Add target element if typing into a field
        if (isTyping && activity.element) {
            const elem = activity.element;
            if (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA') {
                const placeholder = elem.attributes?.placeholder || '';
                const id = elem.id ? `#${elem.id}` : '';
                lines.push({ 
                    text: `           Target: <${elem.tagName.toLowerCase()}${id}> ${placeholder}`, 
                    className: 'terminal-element' 
                });
            }
        }
        
        return lines;
    }

    /**
     * Render marked/grouped action
     */
    renderMarkedAction(activity, time) {
        const lines = [];
        const description = activity.description || activity.data?.description || 'Marked Action';
        const events = activity.events || activity.data?.events || [];
        const duration = activity.duration || activity.data?.duration;
        
        // Main marked action line
        let mainLine = `[${time}] 🎯 MARKED ACTION: "${description}"`;
        lines.push({ text: mainLine, className: 'marked-action' });
        
        // Show event count and duration
        if (events.length > 0 || duration) {
            let subLine = `           └─ `;
            if (events.length > 0) {
                subLine += `${events.length} events captured`;
            }
            if (duration) {
                subLine += ` in ${(duration / 1000).toFixed(1)}s`;
            }
            lines.push({ text: subLine, className: 'terminal-element' });
        }
        
        // Show sub-events if not too many
        if (events.length > 0 && events.length <= 10) {
            events.forEach((event, index) => {
                const eventTime = this.formatTime(event.timestamp);
                let eventLine = `              ${index + 1}. `;
                
                if (event.type === 'click') {
                    const coords = event.coordinates || { x: event.x, y: event.y };
                    eventLine += `Click at (${coords.x}, ${coords.y})`;
                    if (event.element?.selector) {
                        eventLine += ` on ${event.element.selector}`;
                    }
                } else if (event.type === 'keystroke') {
                    eventLine += `Type "${event.keys || event.key}"`;
                } else if (event.type === 'key') {
                    eventLine += `Press ${event.key}`;
                } else {
                    eventLine += event.type;
                }
                
                lines.push({ text: eventLine, className: 'terminal-sub-event' });
            });
        }
        
        return lines;
    }

    /**
     * Render navigation event
     */
    renderNavigation(activity, time) {
        const lines = [];
        const url = activity.url || activity.data?.url || activity.context?.url;
        const from = activity.from || activity.data?.from;
        
        let mainLine = `[${time}] 🔄 NAVIGATE`;
        if (url) {
            mainLine += ` to ${url}`;
        }
        
        lines.push({ text: mainLine, className: 'navigation' });
        
        if (from) {
            lines.push({ 
                text: `           From: ${from}`, 
                className: 'terminal-element' 
            });
        }
        
        return lines;
    }

    /**
     * Render browser context update
     */
    renderBrowserContext(activity, time) {
        const lines = [];
        const status = activity.status || activity.data?.status;
        
        lines.push({ 
            text: `[${time}] 🌐 BROWSER CONTEXT: ${status || 'Updated'}`, 
            className: 'browser-context' 
        });
        
        if (activity.url) {
            lines.push({ 
                text: `           URL: ${activity.url}`, 
                className: 'terminal-element' 
            });
        }
        
        return lines;
    }

    /**
     * Render generic activity
     */
    renderGeneric(activity, time) {
        const lines = [];
        const type = activity.type.toUpperCase().replace(/_/g, ' ');
        
        let mainLine = `[${time}] ● ${type}`;
        if (activity.description) {
            mainLine += `: ${activity.description}`;
        }
        
        lines.push({ text: mainLine, className: 'system' });
        
        return lines;
    }

    /**
     * Add a line to the terminal
     */
    addLine(lineData) {
        const line = document.createElement('div');
        line.className = `terminal-line ${lineData.className || ''}`;
        line.textContent = lineData.text;
        
        this.container.appendChild(line);
        
        // Limit number of lines
        while (this.container.children.length > this.maxLines) {
            this.container.removeChild(this.container.firstChild);
        }
    }

    /**
     * Add a system message
     */
    addSystemMessage(message, type = 'info') {
        const time = this.formatTime();
        const lines = [];
        
        lines.push({ 
            text: `[${time}] ℹ️ SYSTEM: ${message}`, 
            className: 'system' 
        });
        
        lines.forEach(line => this.addLine(line));
    }

    /**
     * Clear the terminal
     */
    clear() {
        this.container.innerHTML = '';
        this.addSystemMessage('Terminal cleared');
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     * Toggle auto-scroll
     */
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        return this.autoScroll;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerminalRenderer;
}