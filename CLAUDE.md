# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron-based RPA platform that captures user workflows WITH FULL CONTEXT and converts them into automation-ready code. It captures not just WHAT users do, but WHY they do it - combining UiPath-level technical capability with AI-powered reasoning capture.

## Architecture

### Process Architecture (Critical)
The application uses a multi-process architecture to handle async operations:
- **Main Process**: Electron main process handles IPC, window management, and spawns workers
- **Renderer Process**: UI and user interaction
- **Browser Worker Process**: Separate Node.js process (`browser-context-worker.js`) for Playwright operations
  - Spawned via `fork()` to avoid Electron async conflicts
  - Communicates via process IPC messages
  - Handles all CDP/browser context operations

### Main Process (`src/main/`)
- **main.js**: Application lifecycle, window management, IPC handlers, global shortcuts, worker process spawning
- **capture-service.js**: System-wide activity capture using uiohook-napi (mouse/keyboard hooks)
- **browser-context-service.js**: Chrome DevTools Protocol integration for DOM context capture
- **browser-context-worker.js**: Separate process for Playwright operations (avoids Electron conflicts)
- **mark-before-handler.js**: Revolutionary pattern that captures intent BEFORE actions
- **window-manager.js**: Window state and behavior management
- **preload.js**: Bridge between main and renderer processes

### Renderer Process (`src/renderer/`)
- **js/app.js**: Main UI controller and state management (includes crypto.randomUUID polyfill)
- **js/activity-tracker.js**: Displays captured activities in real-time
- **js/chat-guide.js**: Interactive guide that asks for context and reasons
- **js/process-engine.js**: Core data model for process nodes, branches, and automation export
- **js/canvas-builder.js**: Visual process map rendering using Canvas API

### Communication Patterns
- Main → Renderer: `mainWindow.webContents.send('event-name', data)`
- Renderer → Main: `window.electronAPI.invoke('action-name', data)`
- Main → Worker: `browserWorker.send({ id, type, data })`
- Worker → Main: `process.send({ id, result, error })`
- Activity flow: CaptureService → Main → Renderer → UI Components
- Mark Before flow: User triggers → Prompt → Capture next 30s → Group events

## Development Commands

```bash
# Install and setup
npm install              # Install dependencies
npm run rebuild          # Rebuild native modules (REQUIRED if uiohook-napi fails)

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

## Global Shortcuts

- `Ctrl+Shift+S` / `Cmd+Shift+S`: Start/stop capture
- `Ctrl+Shift+M` / `Cmd+Shift+M`: Mark important step (Mark Before mode)
- `Ctrl+E` / `Cmd+E`: Quick export
- `F9`: Toggle window visibility

## IPC Events

### Main Process Handles
- `capture:start/stop`: Control recording
- `capture:mark`: Mark important moments
- `mark-before:start`: Initialize Mark Before capture mode (30s window)
- `mark-before:complete`: Finalize grouped action capture
- `browser:connect`: Spawn worker and connect to browser via CDP
- `browser:launch`: Launch new Chrome with debugging enabled
- `browser:get-element`: Get DOM element at coordinates
- `window:always-on-top`: Window pinning toggle
- `window:opacity`: Transparency control (0.5-1.0)
- `system:get-active-app`: Current application info
- `export:save-file`: Save dialog and file writing

### Renderer Receives
- `capture:activity`: New activity data with coordinates
- `mark-before:prompt`: Show Mark Before dialog
- `mark-before:captured`: Grouped action data
- `browser:element-found`: DOM element context data
- `browser:status-changed`: Browser connection status updates
- `shortcut:mark-important`: Global shortcut triggered
- `shortcut:toggle-capture`: Start/stop from shortcut
- `shortcut:export`: Quick export triggered

## Critical Patterns & Solutions

### 1. Mark Before Pattern (Revolutionary)
Captures intent BEFORE actions for cleaner data:
```javascript
// Instead of: capture → guess intent
// We do: declare intent → capture → group related events
markBeforeHandler.startMarkMode(description);
// Captures next 30 seconds of activity as single grouped action
```

### 2. Browser Context via Worker Process
Separate process for async Playwright operations:
```javascript
// Main process spawns worker
browserWorker = fork(path.join(__dirname, 'browser-context-worker.js'));

// Worker handles Playwright async operations
// Avoids Electron main process conflicts
```

### 3. Crypto UUID Polyfill
Handles older browser contexts:
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
Prevents capturing Process Capture Studio's own UI:
```javascript
const isOwnProcess = activeApp?.name?.includes('Process Capture Studio') || 
                    activeApp?.owner?.name?.includes('Electron');
if (isOwnProcess) return; // Skip capture
```

## Process Data Model

ProcessEngine manages nodes with:
- **Action details**: Type, description, timestamp, duration
- **Grouped events**: Mark Before pattern groups related keystrokes/clicks
- **Element data**: Selectors, XPath, attributes, position (via CDP when available)
- **Context**: Application, window, URL, file paths
- **Business logic**: Conditions, reasons, validation rules
- **Branches**: Decision paths and alternatives

### Activity Data Evolution
```javascript
// Basic (v1.0): Coordinates only
{ type: 'click', x: 100, y: 200, app: 'Chrome' }

// With Mark Before (v1.1): Intent grouping
{
  type: 'grouped_action',
  description: 'Search for customer',
  events: [
    { type: 'click', x: 453, y: 234 },
    { type: 'keystroke', keys: 'John Smith' },
    { type: 'key', key: 'Enter' }
  ],
  duration: 3500,
  context: { app: 'Chrome' }
}

// Target with CDP (v2.0): Full DOM context
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

1. **uiohook-napi fails to build**: 
   - Run `npm run rebuild`
   - May need: `npm install --build-from-source`

2. **Keystrokes not captured on Mac**: 
   - System Preferences → Security & Privacy → Privacy → Accessibility
   - Add Terminal/VS Code AND Electron app

3. **Browser context not working**:
   - Click "Launch Capture Browser" button first
   - Check worker process is running: `ps aux | grep browser-context-worker`
   - Browser must have `--remote-debugging-port=9222`

4. **Clear button crash**: 
   - Fixed with crypto.randomUUID polyfill in app.js

5. **Export not downloading**:
   - Fixed in v1.0.0 - uses proper Electron save dialog

## Platform-Specific Notes

### macOS
- **Required Permissions**:
  - Accessibility: System Preferences → Security & Privacy → Privacy → Accessibility
  - Screen Recording: For enhanced browser capture
  - Both Terminal/VS Code AND the Electron app need permissions
- Hardened runtime with entitlements configured

### Windows
- May require Administrator privileges for full capture
- Windows Defender may flag uiohook-napi (false positive)
- COM automation for Office planned

### Linux
- User must be in `input` group: `sudo usermod -a -G input $USER`
- Logout/login required after group change
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
1. Quick test: Create `test-[feature].js` in root
2. Unit tests: `test/unit/[feature].test.js`
3. Integration: `test/integration/[feature]-flow.test.js`
4. Run specific: `npm test -- test/unit/[feature].test.js`

## Quick Debugging

```bash
# Check capture service status (DevTools console)
await window.electronAPI.invoke('capture:status')

# Test IPC communication
window.electronAPI.invoke('system:get-active-app')

# Monitor capture events (npm run dev console)
# Look for: "Capture activity:" logs

# Test Mark Before flow
window.electronAPI.invoke('mark-before:start', 'Test action')

# Check browser worker
ps aux | grep browser-context-worker

# Launch capture browser
window.electronAPI.invoke('browser:launch')

# Force rebuild native modules
rm -rf node_modules package-lock.json
npm install
npm run rebuild
```

## Export Formats

The process engine exports to multiple formats:
- **JSON**: Complete process data structure
- **Playwright**: Browser automation code
- **Python**: Desktop automation with pyautogui
- **Markdown**: Human-readable documentation
- **Mermaid**: Flowchart diagrams

Export flow:
1. User clicks Export → Opens format dialog
2. Select format → Generate code
3. Save dialog → Write to file
4. File downloads to user's chosen location

## Security Considerations

- Passwords never stored (marked as credential fields only)
- All data stored locally in app's userData directory
- No cloud connectivity unless explicitly configured
- Sensitive data can be blurred/excluded from capture
- Process Capture Studio's own activities filtered out
- Browser context runs in separate process for isolation