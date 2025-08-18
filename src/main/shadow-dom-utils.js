/**
 * Shadow DOM Utilities
 * 
 * Comprehensive utilities for detecting, traversing, and handling Shadow DOM
 * in modern web applications including enterprise frameworks like Salesforce Lightning,
 * Vaadin, Material Web Components, and more.
 */

/**
 * Common web component library patterns
 */
const WEB_COMPONENT_PATTERNS = {
    'vaadin-': 'vaadin',
    'mwc-': 'material-web-components',
    'sl-': 'shoelace',
    'ion-': 'ionic',
    'lightning-': 'salesforce-lightning',
    'md-': 'material-design',
    'camp-': 'custom', // ActiveCampaign custom elements
    'lit-': 'lit',
    'polymer-': 'polymer',
    'paper-': 'paper-elements',
    'iron-': 'iron-elements',
    'amp-': 'amp',
    'mdc-': 'material-components',
    'carbon-': 'carbon-design',
    'spectrum-': 'adobe-spectrum',
    'fast-': 'microsoft-fast'
};

/**
 * Framework-generated ID patterns to detect and remove
 */
const FRAMEWORK_ID_PATTERNS = [
    /^ember\d+$/,                    // Ember: ember650
    /^react-[\w-]+$/,                // React: react-select-1
    /^ng-[\w-]+$/,                   // Angular: ng-content-0
    /_ngcontent-[\w-]+$/,            // Angular: _ngcontent-abc-123
    /^data-v-[\w]+$/,                // Vue: data-v-7ba5bd90
    /^aura-pos-\d+$/,                // Salesforce: aura-pos-1
    /^j_id\d+:/,                     // Visualforce: j_id0:j_id1
    /^gsft_[\w]+$/,                  // ServiceNow: gsft_main
    /^ext-gen\d+$/,                  // ExtJS: ext-gen1234
    /^yui_[\w]+$/,                   // YUI: yui_3_17_2_1
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, // UUID
    /^[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12}$/i  // GUID
];

/**
 * Detect if an element is within a Shadow DOM
 */
function detectShadowDOM(element) {
    if (!element) return false;
    
    let current = element;
    while (current && current !== document) {
        if (current.parentNode && current.parentNode instanceof ShadowRoot) {
            return {
                isInShadowDOM: true,
                shadowRoot: current.parentNode,
                shadowHost: current.parentNode.host,
                mode: current.parentNode.mode // 'open' or 'closed'
            };
        }
        current = current.parentNode || current.host;
    }
    
    return { isInShadowDOM: false };
}

/**
 * Build complete path through shadow boundaries
 */
function getShadowPath(element) {
    const path = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== document.body && depth < 20) { // Limit depth to prevent infinite loops
        const parent = current.parentNode;
        
        if (parent && parent instanceof ShadowRoot) {
            // We're inside a shadow root
            const hostElement = parent.host;
            path.unshift({
                type: 'shadow',
                host: hostElement.tagName.toLowerCase(),
                hostSelector: generateStableSelector(hostElement),
                selector: generateStableSelector(current, parent),
                shadowRoot: true,
                mode: parent.mode, // 'open' or 'closed'
                depth: depth
            });
            current = hostElement;
        } else {
            // Regular DOM
            if (current !== element) { // Don't add the target element itself to the path
                path.unshift({
                    type: 'light',
                    selector: generateStableSelector(current),
                    shadowRoot: false,
                    depth: depth
                });
            }
            current = current.parentElement;
        }
        depth++;
    }
    
    return path;
}

/**
 * Generate a stable selector for an element (removing framework IDs)
 */
function generateStableSelector(element, root = document) {
    if (!element) return null;
    
    // Try data attributes first (most stable)
    if (element.dataset) {
        if (element.dataset.testid) return `[data-testid="${element.dataset.testid}"]`;
        if (element.dataset.test) return `[data-test="${element.dataset.test}"]`;
        if (element.dataset.automationId) return `[data-automation-id="${element.dataset.automationId}"]`;
        if (element.dataset.automation) return `[data-automation="${element.dataset.automation}"]`;
    }
    
    // Try ID if it's not framework-generated
    if (element.id && !isFrameworkGeneratedId(element.id)) {
        return `#${element.id}`;
    }
    
    // Try unique attributes
    const uniqueAttrs = ['name', 'aria-label', 'role', 'type', 'placeholder'];
    for (const attr of uniqueAttrs) {
        const value = element.getAttribute(attr);
        if (value) {
            // Check if this selector is unique within the root
            const selector = `${element.tagName.toLowerCase()}[${attr}="${value}"]`;
            const matches = root.querySelectorAll(selector);
            if (matches.length === 1) {
                return selector;
            }
        }
    }
    
    // Try class names (filter out framework classes)
    if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ')
            .filter(cls => cls && !isFrameworkClass(cls))
            .slice(0, 2); // Take first 2 stable classes
        
        if (classes.length > 0) {
            const selector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
            const matches = root.querySelectorAll(selector);
            if (matches.length === 1) {
                return selector;
            }
        }
    }
    
    // Fall back to tag name with index
    const siblings = Array.from(element.parentNode?.children || []);
    const tagSiblings = siblings.filter(el => el.tagName === element.tagName);
    if (tagSiblings.length > 1) {
        const index = tagSiblings.indexOf(element) + 1;
        return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
    }
    
    return element.tagName.toLowerCase();
}

/**
 * Check if an ID is framework-generated
 */
function isFrameworkGeneratedId(id) {
    if (!id) return false;
    return FRAMEWORK_ID_PATTERNS.some(pattern => pattern.test(id));
}

/**
 * Check if a class name is framework-generated
 */
function isFrameworkClass(className) {
    if (!className) return false;
    
    const frameworkClassPatterns = [
        /^ng-/,
        /^v-/,
        /^ember-/,
        /^react-/,
        /^css-[\w]+$/, // CSS modules
        /^sc-[\w]+$/, // Styled components
        /^[a-z0-9]{6,}$/ // Hashed class names
    ];
    
    return frameworkClassPatterns.some(pattern => pattern.test(className));
}

/**
 * Detect Shadow Root mode (open/closed)
 */
function detectShadowRootMode(element) {
    const shadowInfo = detectShadowDOM(element);
    if (shadowInfo.isInShadowDOM) {
        return shadowInfo.mode;
    }
    
    // Check if element itself has a shadow root
    if (element.shadowRoot) {
        return 'open'; // If we can access it, it's open
    }
    
    // Try to detect closed shadow root (we can't access it, but we can detect its presence)
    // This is a heuristic - if element has no children but has rendered content
    if (element.children.length === 0 && element.offsetHeight > 0) {
        // Might have a closed shadow root
        return 'possibly-closed';
    }
    
    return null;
}

/**
 * Find the shadow host element
 */
function getHostElement(element) {
    const shadowInfo = detectShadowDOM(element);
    if (shadowInfo.isInShadowDOM) {
        return shadowInfo.shadowHost;
    }
    return null;
}

/**
 * Check if element is a web component
 */
function detectWebComponent(element) {
    if (!element) return { isWebComponent: false };
    
    const tagName = element.tagName.toLowerCase();
    
    // Check if it's a custom element (contains hyphen)
    if (!tagName.includes('-')) {
        return { isWebComponent: false };
    }
    
    // Check for known component library patterns
    for (const [prefix, framework] of Object.entries(WEB_COMPONENT_PATTERNS)) {
        if (tagName.startsWith(prefix)) {
            return {
                isWebComponent: true,
                framework,
                tagName,
                hasOpenShadowRoot: !!element.shadowRoot,
                customElement: window.customElements.get(tagName) !== undefined
            };
        }
    }
    
    // Check if it's a registered custom element
    if (window.customElements && window.customElements.get(tagName)) {
        return {
            isWebComponent: true,
            framework: 'custom',
            tagName,
            hasOpenShadowRoot: !!element.shadowRoot,
            customElement: true
        };
    }
    
    // Generic web component (has hyphen but not registered)
    return {
        isWebComponent: true,
        framework: 'unknown',
        tagName,
        hasOpenShadowRoot: !!element.shadowRoot,
        customElement: false
    };
}

/**
 * Identify enterprise framework
 */
function detectEnterpriseFramework(element, document) {
    // Check for Salesforce Lightning
    if (document.querySelector('force-app, lightning-app, aura-app')) {
        return 'salesforce-lightning';
    }
    
    // Check for Vaadin
    if (document.querySelector('vaadin-app-layout, vaadin-grid')) {
        return 'vaadin';
    }
    
    // Check for ServiceNow
    if (window.NOW || document.querySelector('[glide-field], .navbar-ServiceNow')) {
        return 'servicenow';
    }
    
    // Check for Microsoft Dynamics
    if (window.Xrm || document.querySelector('[data-id*="MscrmControls"]')) {
        return 'dynamics';
    }
    
    // Check for SAP UI5
    if (window.sap || document.querySelector('[data-sap-ui]')) {
        return 'sap-ui5';
    }
    
    // Check for Workday
    if (document.querySelector('[data-automation-id]')) {
        return 'workday';
    }
    
    // Check for Material Design
    if (document.querySelector('mwc-button, mwc-textfield, mat-button')) {
        return 'material-design';
    }
    
    return null;
}

/**
 * Generate shadow pierce selector for tools that don't auto-pierce
 */
function generateShadowPierceSelector(element, shadowPath) {
    if (!shadowPath || shadowPath.length === 0) {
        return generateStableSelector(element);
    }
    
    // Build >>> syntax (not all tools support this)
    let pierceSelector = '';
    
    for (const step of shadowPath) {
        if (step.shadowRoot) {
            if (pierceSelector) {
                pierceSelector += ' >>> ';
            }
            pierceSelector += step.hostSelector;
        }
    }
    
    if (pierceSelector) {
        pierceSelector += ' >>> ' + generateStableSelector(element);
    }
    
    return pierceSelector;
}

/**
 * Generate JavaScript path for shadow DOM traversal
 */
function generateJavaScriptPath(element, shadowPath) {
    if (!shadowPath || shadowPath.length === 0) {
        return `document.querySelector('${generateStableSelector(element)}')`;
    }
    
    let code = '';
    let varName = 'element';
    
    // Start with the top-most shadow host
    const firstShadowStep = shadowPath.find(step => step.shadowRoot);
    if (firstShadowStep) {
        code = `let ${varName} = document.querySelector('${firstShadowStep.hostSelector}');\n`;
        
        // Traverse through shadow roots
        for (const step of shadowPath) {
            if (step.shadowRoot) {
                code += `if (${varName} && ${varName}.shadowRoot) {\n`;
                code += `  ${varName} = ${varName}.shadowRoot.querySelector('${step.selector}');\n`;
                code += `}\n`;
            }
        }
    }
    
    return code;
}

/**
 * Clean CSS selector by removing framework IDs
 */
function cleanFrameworkSelector(selector) {
    if (!selector) return selector;
    
    // Remove framework-generated IDs
    let cleaned = selector;
    
    // Remove #ember123 style IDs
    cleaned = cleaned.replace(/#ember\d+/g, '');
    cleaned = cleaned.replace(/#react-[\w-]+/g, '');
    cleaned = cleaned.replace(/#ng-[\w-]+/g, '');
    cleaned = cleaned.replace(/#ext-gen\d+/g, '');
    cleaned = cleaned.replace(/#yui_[\w]+/g, '');
    
    // Remove framework-generated classes
    cleaned = cleaned.replace(/\.ng-[\w-]+/g, '');
    cleaned = cleaned.replace(/\.ember-[\w-]+/g, '');
    cleaned = cleaned.replace(/\.react-[\w-]+/g, '');
    
    // Remove empty selectors
    cleaned = cleaned.replace(/\s+>/g, ' >');
    cleaned = cleaned.replace(/>\s+/g, '> ');
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Clean up any resulting empty parts
    cleaned = cleaned.replace(/^\s*>\s*/, '');
    cleaned = cleaned.replace(/\s*>\s*$/, '');
    
    return cleaned.trim();
}

/**
 * Generate multiple alternative selectors for fallback
 */
function generateAlternativeSelectors(element, shadowPath) {
    const alternatives = [];
    
    // Strategy 1: Data attributes
    if (element.dataset) {
        Object.entries(element.dataset).forEach(([key, value]) => {
            if (value && !isFrameworkGeneratedId(value)) {
                alternatives.push(`[data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}="${value}"]`);
            }
        });
    }
    
    // Strategy 2: ARIA attributes
    ['aria-label', 'aria-labelledby', 'aria-describedby', 'role'].forEach(attr => {
        const value = element.getAttribute(attr);
        if (value) {
            alternatives.push(`[${attr}="${value}"]`);
        }
    });
    
    // Strategy 3: Parent + child combination
    if (element.parentElement) {
        const parentSelector = generateStableSelector(element.parentElement);
        if (parentSelector) {
            alternatives.push(`${parentSelector} > ${element.tagName.toLowerCase()}`);
        }
    }
    
    // Strategy 4: Text content (for buttons, links)
    if (element.textContent && ['BUTTON', 'A', 'SPAN'].includes(element.tagName)) {
        const text = element.textContent.trim().substring(0, 30);
        if (text) {
            // Playwright-specific selector
            alternatives.push(`${element.tagName.toLowerCase()}:has-text("${text}")`);
            // XPath alternative
            alternatives.push(`xpath=//${element.tagName.toLowerCase()}[contains(text(), "${text}")]`);
        }
    }
    
    // Strategy 5: Shadow DOM specific (if applicable)
    if (shadowPath && shadowPath.length > 0) {
        const shadowHost = shadowPath.find(s => s.shadowRoot);
        if (shadowHost) {
            alternatives.push(`${shadowHost.hostSelector} >>> ${element.tagName.toLowerCase()}`);
        }
    }
    
    // Strategy 6: Index-based selector as last resort
    const siblings = Array.from(element.parentElement?.children || []);
    const index = siblings.indexOf(element);
    if (index >= 0) {
        alternatives.push(`${element.parentElement ? generateStableSelector(element.parentElement) + ' > ' : ''}${element.tagName.toLowerCase()}:nth-child(${index + 1})`);
    }
    
    // Remove duplicates and empty values
    return [...new Set(alternatives.filter(Boolean))];
}

module.exports = {
    detectShadowDOM,
    getShadowPath,
    detectShadowRootMode,
    getHostElement,
    detectWebComponent,
    detectEnterpriseFramework,
    generateStableSelector,
    isFrameworkGeneratedId,
    isFrameworkClass,
    generateShadowPierceSelector,
    generateJavaScriptPath,
    cleanFrameworkSelector,
    generateAlternativeSelectors,
    WEB_COMPONENT_PATTERNS,
    FRAMEWORK_ID_PATTERNS
};