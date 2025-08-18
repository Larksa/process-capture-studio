/**
 * Field Mapping Service - Captures mappings between CSV/Excel columns and web form fields
 * Provides simple, explicit field-to-field relationships for automation runners
 */

class FieldMappingService {
    constructor() {
        this.reset();
    }

    /**
     * Reset mapping state
     */
    reset() {
        this.isActive = false;
        this.mappings = [];
        this.currentSource = null;
        this.waitingForSource = true;
        this.navigationSteps = [];  // Track navigation between source and destination
        this.recordingNavigation = false;
        this.formUrl = null;
        this.formIdentifier = null;
    }

    /**
     * Start mapping mode
     */
    startMappingMode(options = {}) {
        this.reset();
        this.isActive = true;
        this.formUrl = options.url || null;
        console.log('🔗 Field mapping mode activated');
        return {
            status: 'active',
            message: 'Click on a CSV/Excel column to start mapping'
        };
    }

    /**
     * Stop mapping mode
     */
    stopMappingMode() {
        const mappingCount = this.mappings.length;
        this.isActive = false;
        console.log(`🔗 Field mapping mode deactivated. Created ${mappingCount} mappings`);
        return {
            status: 'inactive',
            mappingCount,
            mappings: this.mappings
        };
    }

    /**
     * Handle any event during mapping mode (click, clipboard, etc.)
     */
    handleMappingEvent(event) {
        if (!this.isActive) return null;

        // Handle clipboard events specially
        if (event.type === 'clipboard' && event.action === 'copy') {
            // This is a copy event - likely source selection
            if (this.waitingForSource) {
                return this.captureSourceFromClipboard(event);
            }
        } else if (event.type === 'clipboard' && event.action === 'paste') {
            // This is a paste event - likely destination
            if (!this.waitingForSource && this.currentSource) {
                return this.captureDestinationFromPaste(event);
            }
        } else if (event.type === 'click') {
            // Handle regular click events
            return this.handleMappingClick(event);
        }
        
        return null;
    }
    
    /**
     * Handle click event during mapping mode
     */
    handleMappingClick(event) {
        if (!this.isActive) return null;

        if (this.waitingForSource) {
            return this.captureSource(event);
        } else if (this.recordingNavigation) {
            // Check if this is a destination field or navigation step
            if (this.isDestinationField(event)) {
                return this.captureDestination(event);
            } else {
                // It's a navigation step (tab click, dropdown, etc.)
                return this.captureNavigationStep(event);
            }
        } else {
            return this.captureDestination(event);
        }
    }
    
    /**
     * Capture source from clipboard copy event
     */
    captureSourceFromClipboard(event) {
        const sourceInfo = {
            type: 'clipboard',
            content: event.content,
            contentPreview: event.contentPreview,
            application: event.source?.application,
            display: null
        };
        
        // If it's from Excel
        if (event.source?.excel_selection) {
            sourceInfo.type = 'excel';
            sourceInfo.column = event.source.excel_selection.address;
            sourceInfo.sheet = event.source.excel_selection.sheet;
            sourceInfo.workbook = event.source.excel_selection.workbook;
            sourceInfo.sampleValue = event.content;
            sourceInfo.display = `Excel ${event.source.excel_selection.address}: "${event.contentPreview}"`;
        } else {
            sourceInfo.display = `Copied: "${event.contentPreview}"`;
        }
        
        this.currentSource = sourceInfo;
        this.waitingForSource = false;
        this.recordingNavigation = true;
        this.navigationSteps = [];
        
        return {
            status: 'source_captured',
            source: sourceInfo,
            message: `Source captured: ${sourceInfo.display}. Now navigate to and click on the form field.`
        };
    }
    
    /**
     * Capture destination from paste event
     */
    captureDestinationFromPaste(event) {
        // Look for browser context in the event or recent events
        const destinationInfo = {
            type: 'web_form',
            application: event.application || 'Browser',
            url: event.browserContext?.url,
            display: 'Form field (pasted)',
            fieldType: 'text'
        };
        
        // Try to get more context from browser
        if (event.browserContext?.element) {
            destinationInfo.selector = event.browserContext.element.selector;
            destinationInfo.tagName = event.browserContext.element.tagName;
            destinationInfo.display = event.browserContext.element.placeholder || 
                                    event.browserContext.element.name || 
                                    'Form field';
        }
        
        // Create mapping with navigation steps
        const mapping = {
            id: `mapping_${Date.now()}`,
            source: this.currentSource,
            destination: destinationInfo,
            navigationSteps: [...this.navigationSteps],
            created: new Date().toISOString()
        };
        
        this.mappings.push(mapping);
        
        // Reset for next mapping
        this.currentSource = null;
        this.waitingForSource = true;
        this.recordingNavigation = false;
        this.navigationSteps = [];
        
        return {
            status: 'mapping_created',
            mapping,
            totalMappings: this.mappings.length,
            message: `Mapped ${mapping.source.display} → ${destinationInfo.display}. Click another source or click Done.`
        };
    }

    /**
     * Capture source field (CSV/Excel column)
     */
    captureSource(event) {
        // Extract column information from the event
        const sourceInfo = this.extractSourceInfo(event);
        
        if (!sourceInfo) {
            return {
                status: 'error',
                message: 'Please click on a CSV or Excel cell'
            };
        }

        this.currentSource = sourceInfo;
        this.waitingForSource = false;
        this.recordingNavigation = true;  // Start recording navigation steps
        this.navigationSteps = [];  // Reset navigation steps for this mapping

        return {
            status: 'source_captured',
            source: sourceInfo,
            message: `Source captured: ${sourceInfo.display}. Now navigate to and click on the form field.`
        };
    }

    /**
     * Capture destination field (web form input)
     */
    captureDestination(event) {
        // Extract form field information from the event
        const destinationInfo = this.extractDestinationInfo(event);
        
        if (!destinationInfo) {
            return {
                status: 'error',
                message: 'Please click on a form input field'
            };
        }

        // Create mapping with navigation steps
        const mapping = {
            id: `mapping_${Date.now()}`,
            source: this.currentSource,
            destination: destinationInfo,
            navigationSteps: [...this.navigationSteps],  // Include captured navigation
            created: new Date().toISOString()
        };

        this.mappings.push(mapping);
        
        // Reset for next mapping
        this.currentSource = null;
        this.waitingForSource = true;
        this.recordingNavigation = false;
        this.navigationSteps = [];

        return {
            status: 'mapping_created',
            mapping,
            totalMappings: this.mappings.length,
            message: `Mapped ${mapping.source.display} → ${destinationInfo.display}. Click another CSV column or click Done.`
        };
    }

    /**
     * Capture navigation step (tab click, dropdown, etc.)
     */
    captureNavigationStep(event) {
        const navStep = {
            type: event.type,
            timestamp: Date.now(),
            element: null,
            action: null
        };

        // Determine navigation type
        if (event.type === 'click') {
            const tagName = event.element?.tagName?.toLowerCase() || event.context?.tagName?.toLowerCase();
            
            // Tab navigation
            if (event.element?.role === 'tab' || event.element?.className?.includes('tab')) {
                navStep.action = 'tab_click';
                navStep.element = {
                    selector: event.element?.selectors?.css || this.buildSelector(event),
                    text: event.element?.text || event.element?.textContent,
                    label: event.element?.ariaLabel
                };
            }
            // Dropdown/select
            else if (tagName === 'select' || event.element?.role === 'combobox') {
                navStep.action = 'dropdown_open';
                navStep.element = {
                    selector: event.element?.selectors?.css || this.buildSelector(event),
                    name: event.element?.selectors?.attributes?.name
                };
            }
            // Accordion/collapsible
            else if (event.element?.role === 'button' && 
                     (event.element?.ariaExpanded !== undefined || 
                      event.element?.className?.includes('collapse') ||
                      event.element?.className?.includes('accordion'))) {
                navStep.action = 'expand_section';
                navStep.element = {
                    selector: event.element?.selectors?.css || this.buildSelector(event),
                    text: event.element?.text || event.element?.textContent
                };
            }
            // Modal/dialog trigger
            else if (event.element?.attributes?.['data-toggle'] === 'modal' ||
                     event.element?.attributes?.['data-bs-toggle'] === 'modal') {
                navStep.action = 'open_modal';
                navStep.element = {
                    selector: event.element?.selectors?.css || this.buildSelector(event),
                    modalTarget: event.element?.attributes?.['data-target'] || 
                                event.element?.attributes?.['data-bs-target']
                };
            }
            // Generic navigation click
            else {
                navStep.action = 'navigation_click';
                navStep.element = {
                    selector: event.element?.selectors?.css || this.buildSelector(event),
                    text: event.element?.text || event.element?.textContent,
                    href: event.element?.attributes?.href
                };
            }
        }
        // Scroll events
        else if (event.type === 'scroll' || event.type === 'wheel') {
            navStep.action = 'scroll';
            navStep.element = {
                direction: event.deltaY > 0 ? 'down' : 'up',
                amount: Math.abs(event.deltaY || 0)
            };
        }
        // Keyboard navigation
        else if (event.type === 'keydown') {
            if (event.key === 'Tab') {
                navStep.action = 'tab_key';
                navStep.element = { shiftKey: event.shiftKey };
            } else if (event.key === 'Enter') {
                navStep.action = 'enter_key';
            }
        }

        // Add to navigation steps if it's a meaningful action
        if (navStep.action) {
            this.navigationSteps.push(navStep);
            
            return {
                status: 'navigation_captured',
                step: navStep,
                totalSteps: this.navigationSteps.length,
                message: `Navigation step recorded: ${navStep.action}`
            };
        }

        // Continue recording
        return {
            status: 'continue_recording',
            message: 'Continue navigating to the form field'
        };
    }

    /**
     * Check if event is clicking on a destination field
     */
    isDestinationField(event) {
        // Check if it's a form input element
        const tagName = event.element?.tagName?.toLowerCase() || event.context?.tagName?.toLowerCase();
        
        // Direct form inputs
        if (['input', 'textarea'].includes(tagName)) {
            const inputType = event.element?.type || event.context?.type || 'text';
            // Exclude buttons and non-data inputs
            if (!['button', 'submit', 'reset', 'image'].includes(inputType)) {
                return true;
            }
        }
        
        // Select elements (when actually selecting an option, not just opening)
        if (tagName === 'option') {
            return true;
        }
        
        // Contenteditable elements
        if (event.element?.attributes?.contenteditable === 'true') {
            return true;
        }
        
        // Custom form controls with specific roles
        if (event.element?.role === 'textbox' || 
            event.element?.role === 'searchbox' ||
            event.element?.role === 'spinbutton') {
            return true;
        }
        
        return false;
    }

    /**
     * Extract source information from event
     */
    extractSourceInfo(event) {
        const sourceInfo = {
            type: null,
            column: null,
            columnIndex: null,
            header: null,
            sampleValue: null,
            display: null
        };

        // Check if it's Excel data
        if (event.pythonEvent?.type === 'excel_selection') {
            const excel = event.pythonEvent;
            sourceInfo.type = 'excel';
            sourceInfo.column = excel.address;
            sourceInfo.header = this.detectExcelHeader(excel);
            sourceInfo.sampleValue = excel.value;
            sourceInfo.display = `Excel ${excel.address}`;
            sourceInfo.workbook = excel.workbook;
            sourceInfo.sheet = excel.sheet;
            return sourceInfo;
        }

        // Check if it's CSV data (from clipboard or table selection)
        if (event.context?.application?.includes('CSV') || 
            event.context?.dataType === 'csv' ||
            event.element?.tagName === 'TD') {
            
            sourceInfo.type = 'csv';
            
            // Try to detect column from table cell
            if (event.element?.cellIndex !== undefined) {
                sourceInfo.columnIndex = event.element.cellIndex;
                sourceInfo.header = this.detectTableHeader(event);
                sourceInfo.sampleValue = event.element?.textContent;
                sourceInfo.display = sourceInfo.header || `Column ${sourceInfo.columnIndex + 1}`;
            }
            
            // Or from clipboard with tab-separated data
            else if (event.pythonEvent?.data_type === 'tabular') {
                sourceInfo.type = 'csv_clipboard';
                sourceInfo.sampleValue = event.pythonEvent.content;
                sourceInfo.display = 'CSV Data (from clipboard)';
            }
            
            return sourceInfo;
        }

        // Check for generic text selection that might be CSV
        if (event.type === 'copy' && event.content) {
            // Simple heuristic: if it contains commas or tabs, might be CSV
            if (event.content.includes(',') || event.content.includes('\t')) {
                sourceInfo.type = 'possible_csv';
                sourceInfo.sampleValue = event.content.substring(0, 50);
                sourceInfo.display = 'Selected Data';
                return sourceInfo;
            }
        }

        return null;
    }

    /**
     * Extract destination information from event
     */
    extractDestinationInfo(event) {
        const destInfo = {
            type: null,
            selector: null,
            fieldType: null,
            label: null,
            display: null,
            required: false,
            maxLength: null
        };

        // Check if it's a web form element
        if (event.element?.selectors) {
            const sel = event.element.selectors;
            destInfo.type = 'web_form';
            destInfo.selector = sel.id ? `#${sel.id}` : 
                               sel.css || 
                               sel.xpath;
            destInfo.fieldType = event.element.type || 'text';
            destInfo.label = this.detectFieldLabel(event);
            destInfo.display = destInfo.label || destInfo.selector;
            
            // Extract additional attributes
            if (sel.attributes) {
                destInfo.required = sel.attributes.required === 'true';
                destInfo.maxLength = sel.attributes.maxlength;
                destInfo.placeholder = sel.attributes.placeholder;
            }
            
            return destInfo;
        }

        // Check for click on form field
        if (event.type === 'click' && event.context?.tagName) {
            const tagName = event.context.tagName.toLowerCase();
            if (['input', 'select', 'textarea'].includes(tagName)) {
                destInfo.type = 'form_field';
                destInfo.fieldType = tagName === 'select' ? 'select' : 
                                   event.context.type || 'text';
                destInfo.selector = this.buildSelector(event);
                destInfo.label = event.context.text || event.context.placeholder;
                destInfo.display = destInfo.label || `Form ${destInfo.fieldType}`;
                return destInfo;
            }
        }

        return null;
    }

    /**
     * Detect Excel column header
     */
    detectExcelHeader(excelData) {
        // In a real implementation, might look at row 1 of the same column
        // For now, use column letter
        const match = excelData.address?.match(/\$?([A-Z]+)\$/);
        return match ? `Column ${match[1]}` : null;
    }

    /**
     * Detect table header for CSV
     */
    detectTableHeader(event) {
        // Look for TH element in same column
        // This is simplified - real implementation would traverse DOM
        return event.element?.columnHeader || null;
    }

    /**
     * Detect form field label
     */
    detectFieldLabel(event) {
        // Look for associated label element
        if (event.element?.selectors?.attributes?.name) {
            // Convert name to readable format: first_name → First Name
            const name = event.element.selectors.attributes.name;
            return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return event.element?.selectors?.text || 
               event.element?.selectors?.attributes?.placeholder ||
               null;
    }

    /**
     * Build selector from event
     */
    buildSelector(event) {
        if (event.context?.id) {
            return `#${event.context.id}`;
        }
        if (event.context?.className) {
            return `.${event.context.className.split(' ')[0]}`;
        }
        if (event.context?.name) {
            return `[name="${event.context.name}"]`;
        }
        return event.context?.tagName?.toLowerCase() || 'unknown';
    }

    /**
     * Get current mappings
     */
    getMappings() {
        return {
            mappings: this.mappings,
            count: this.mappings.length,
            formUrl: this.formUrl
        };
    }

    /**
     * Export mappings in format for automation runners
     */
    exportMappings() {
        return {
            version: '1.1',  // Updated version for navigation support
            created: new Date().toISOString(),
            workflow_type: 'field_mapping_with_navigation',
            form_url: this.formUrl,
            mappings: this.mappings.map(m => ({
                source_column: m.source.header || m.source.column || m.source.display,
                source_type: m.source.type,
                source_sample: m.source.sampleValue,
                destination_selector: m.destination.selector,
                destination_type: m.destination.fieldType,
                destination_label: m.destination.label,
                navigation_required: m.navigationSteps?.length > 0,
                navigation_steps: m.navigationSteps?.map(step => ({
                    action: step.action,
                    element: step.element,
                    timestamp_offset: step.timestamp - m.navigationSteps[0]?.timestamp || 0
                }))
            })),
            metadata: {
                total_mappings: this.mappings.length,
                mappings_with_navigation: this.mappings.filter(m => m.navigationSteps?.length > 0).length,
                source_types: [...new Set(this.mappings.map(m => m.source.type))],
                destination_types: [...new Set(this.mappings.map(m => m.destination.type))],
                navigation_actions: [...new Set(this.mappings.flatMap(m => 
                    m.navigationSteps?.map(s => s.action) || []
                ))]
            }
        };
    }

    /**
     * Remove a mapping by ID
     */
    removeMapping(mappingId) {
        const index = this.mappings.findIndex(m => m.id === mappingId);
        if (index > -1) {
            const removed = this.mappings.splice(index, 1);
            return {
                success: true,
                removed: removed[0],
                remainingCount: this.mappings.length
            };
        }
        return {
            success: false,
            message: 'Mapping not found'
        };
    }

    /**
     * Clear all mappings
     */
    clearMappings() {
        const count = this.mappings.length;
        this.mappings = [];
        return {
            success: true,
            clearedCount: count
        };
    }
}

module.exports = FieldMappingService;