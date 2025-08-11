# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron-based RPA platform that captures user workflows WITH FULL CONTEXT and converts them into automation-ready code. It captures not just WHAT users do, but WHY they do it - combining UiPath-level technical capability with AI-powered reasoning capture.

## Architecture

### Main Process (`src/main/`)
- **main.js**: Application lifecycle, window management, IPC handlers, global shortcuts
- **capture-service.js**: System-wide activity capture using uiohook-napi
- **browser-context-service.js**: Chrome DevTools Protocol integration for DOM context capture
- **mark-before-handler.js**: Revolutionary pattern that captures intent BEFORE actions (cleaner data)
- **window-manager.js**: Window state and behavior management
- **preload.js**: Bridge between main and renderer processes

### Renderer Process (`src/renderer/`)
- **app.js**: Main UI controller and state management (includes crypto.randomUUID polyfill)
- **activity-tracker.js**: Displays captured activities in real-time
- **chat-guide.js**: Interactive guide that asks for context and reasons
- **process-engine.js**: Core data model for process nodes, branches, and automation export
- **canvas-builder.js**: Visual process map rendering using Canvas API

### Key Communication Patterns
- Main → Renderer: `mainWindow.webContents.send('event-name', data)`
- Renderer → Main: `window.electronAPI.invoke('action-name', data)`
- Activity flow: CaptureService → Main → Renderer → UI Components
- Mark Before flow: User triggers → Prompt → Capture next action → Group events

## Development Commands

```bash
# Install and setup
npm install              # Install dependencies
npm run rebuild          # Rebuild native modules (if uiohook-napi fails)

# Development
npm run dev              # Development mode with auto-reload and DevTools
npm start                # Production mode

# Testing
npm test                 # Run all tests
npm test:watch          # Run tests in watch mode
npm test:coverage       # Generate coverage report
npm test:e2e            # Run Playwright e2e tests
npm test -- test/unit/mark-before-handler.test.js  # Run specific test

# Building
npm run build            # Build for current platform
npm run build:win        # Windows executable
npm run build:mac        # macOS app
npm run build:linux      # Linux AppImage
npm run build:all        # All platforms

# Cleanup
npm run clean            # Remove dist, builds, node_modules
```

## Testing Framework

### Jest Configuration
- Test environment: Node
- Test location: `/test` directory
- Electron mocking: `/test/mocks/electron.js`
- Coverage excludes renderer tests (for now)
- Timeout: 10 seconds per test

### Test Structure
```
test/
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests for feature flows
├── e2e/           # End-to-end Playwright tests
├── fixtures/      # Test data and fixtures
├── mocks/         # Mock implementations (Electron)
└── utils/         # Test utilities (event generators)
```

## Key Technologies

### Current Stack
- **Electron 27**: Desktop framework
- **uiohook-napi**: System-wide keyboard/mouse capture (coordinates only)
- **active-win**: Active window information
- **playwright**: Browser automation and CDP integration (partially integrated)

### Recent Implementations
1. **Mark Before Pattern**: Captures user intent before actions for cleaner data
2. **Browser Context Service**: CDP connection for DOM element capture (in progress)
3. **Activity Filtering**: Filters out Process Capture Studio's own activities
4. **Crypto Polyfill**: Fallback for crypto.randomUUID in older browser contexts

## Global Shortcuts

- `Ctrl+Shift+S` / `Cmd+Shift+S`: Start/stop capture
- `Ctrl+Shift+M` / `Cmd+Shift+M`: Mark important step (Mark Before mode)
- `Ctrl+E` / `Cmd+E`: Quick export
- `F9`: Toggle window visibility

## IPC Events

### Main Process Handles
- `capture:start/stop`: Control recording
- `capture:mark`: Mark important moments
- `mark-before:start`: Initialize Mark Before capture mode
- `mark-before:complete`: Finalize grouped action capture
- `browser:connect`: Attempt CDP connection to browser
- `browser:get-element`: Get DOM element at coordinates
- `window:always-on-top`: Window pinning
- `window:opacity`: Transparency control
- `system:get-active-app`: Current application info
- `export:save-file`: Save dialog and file writing

### Renderer Receives
- `capture:activity`: New activity data
- `mark-before:prompt`: Show Mark Before dialog
- `mark-before:captured`: Grouped action data
- `browser:element-found`: DOM element context data
- `shortcut:mark-important`: Global shortcut triggered
- `shortcut:toggle-capture`: Start/stop from shortcut
- `shortcut:export`: Quick export triggered

## Critical Patterns & Solutions

### 1. Mark Before Pattern
Revolutionary approach that prompts for intent BEFORE actions:
```javascript
// Instead of: capture → guess intent
// We do: declare intent → capture → group related events
markBeforeHandler.startMarkMode(description);
// Captures next 30 seconds of activity as single grouped action
```

### 2. Browser Context via CDP
Connects to running Chrome/Edge for DOM context:
```javascript
// Chrome must run with: --remote-debugging-port=9222
await browserContextService.connectToExistingBrowser();
const element = await browserContextService.getElementAtPoint(x, y);
```

### 3. Crypto UUID Polyfill
Handles older browser contexts without crypto.randomUUID:
```javascript
if (!crypto.randomUUID) {
  crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}
```

### 4. Self-Activity Filtering
Prevents capturing Process Capture Studio's own UI interactions:
```javascript
const isOwnProcess = activeApp?.name?.includes('Process Capture Studio') || 
                    activeApp?.owner?.name?.includes('Electron');
if (isOwnProcess) return; // Skip capture
```

## Process Data Model

ProcessEngine manages nodes with:
- **Action details**: Type, description, timestamp, duration
- **Grouped events**: Mark Before pattern groups related keystrokes/clicks
- **Element data**: Selectors, XPath, attributes, position (via CDP)
- **Context**: Application, window, URL, file paths
- **Business logic**: Conditions, reasons, validation rules
- **Branches**: Decision paths and alternatives

### Activity Data Evolution
```javascript
// Basic (v1.0):
{ type: 'click', x: 100, y: 200, app: 'Chrome' }

// With Mark Before (v1.1):
{
  type: 'grouped_action',
  description: 'Search for customer',
  events: [
    { type: 'click', target: 'search_field' },
    { type: 'keystroke', text: 'John Smith' },
    { type: 'key', key: 'Enter' }
  ],
  duration: 3500,
  context: { app: 'Chrome', url: 'crm.example.com' }
}

// Target with CDP (v2.0):
{
  type: 'click',
  coordinates: { x: 100, y: 200 },
  element: {
    selector: '#customer-search',
    xpath: '//input[@id="customer-search"]',
    text: 'Search customers...',
    attributes: { placeholder: 'Search customers...' }
  },
  context: {
    app: 'Chrome',
    url: 'https://crm.example.com/customers',
    title: 'Customer Management'
  },
  businessContext: 'Searching for customer to update order'
}
```

## Known Issues & Workarounds

1. **uiohook-napi fails to build**: Run `npm run rebuild`
2. **Keystrokes not captured on Mac**: Check accessibility permissions
3. **Canvas performance with many nodes**: Implement virtualization (planned)
4. **CDP connection fails**: Ensure Chrome runs with `--remote-debugging-port=9222`
5. **Clear button crash**: Fixed with crypto.randomUUID polyfill

## Platform-Specific Notes

### macOS
- Requires accessibility permissions (System Preferences → Security → Privacy)
- May need screen recording permission
- Hardened runtime with entitlements configured

### Windows
- May require Administrator privileges for full capture
- COM automation needed for Office integration (planned)

### Linux
- User must be in `input` group for keystroke capture
- AppImage format for distribution

## Development Workflow

### Adding New Capture Capabilities
1. Create service in `src/main/` (e.g., `excel-context-service.js`)
2. Add IPC handlers in `main.js`
3. Update activity data structure in `process-engine.js`
4. Add UI feedback in `activity-tracker.js`
5. Write tests in `test/unit/` and `test/integration/`
6. Update export formats in `process-engine.js`

### Testing New Features
1. Create test file: `test-[feature].js` in root for quick testing
2. Add unit tests: `test/unit/[feature].test.js`
3. Add integration tests: `test/integration/[feature]-flow.test.js`
4. Run with: `npm test -- test/unit/[feature].test.js`

## Quick Debugging Tips

```bash
# Check if capture service is running
# In DevTools console:
await window.electronAPI.invoke('capture:status')

# Test IPC communication
window.electronAPI.invoke('system:get-active-app')

# Monitor capture events
# In main process console (npm run dev shows this)
# Look for: "Capture activity:" logs

# Test Mark Before flow
window.electronAPI.invoke('mark-before:start', 'Test action')

# Check CDP connection
window.electronAPI.invoke('browser:connect')

# Force rebuild native modules
rm -rf node_modules && npm install && npm run rebuild
```

## Security Considerations

- Passwords are never stored (marked as credential fields only)
- All data stored locally in app's userData directory
- No cloud connectivity unless explicitly configured
- Sensitive data can be blurred/excluded from capture
- Process Capture Studio's own activities are filtered out