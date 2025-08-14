# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron-based RPA platform that captures user workflows WITH FULL CONTEXT and converts them into automation-ready code. It captures not just WHAT users do, but WHY they do it - combining UiPath-level technical capability with AI-powered reasoning capture.

## Architecture

### Multi-Process Architecture (Critical)
The application uses THREE separate processes to handle async operations:
- **Main Process**: Electron main process handles IPC, window management, and spawns workers
- **Renderer Process**: UI and user interaction
- **Browser Worker Process**: Separate Node.js process (`browser-context-worker.js`) for Playwright operations
  - Spawned via `fork()` to avoid Electron async conflicts
  - Communicates via process IPC messages
  - Handles all CDP/browser context operations

### Communication Flow
```
User Action → Renderer → Main Process → Worker Process
                ↓           ↓              ↓
            UI Update   Capture Service  Browser Context
```

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

# Cleanup
npm run clean            # Remove dist, builds, node_modules
```

## Critical Patterns

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

// Send request with unique ID
const requestId = Date.now().toString();
browserWorkerRequests.set(requestId, { resolve, reject });
browserWorker.send({ id: requestId, type: 'connect', data });

// Worker responds with same ID
process.on('message', ({ id, result, error }) => {
  const request = browserWorkerRequests.get(id);
  if (request) {
    error ? request.reject(error) : request.resolve(result);
    browserWorkerRequests.delete(id);
  }
});
```

### 3. Activity Data Evolution Pattern
```javascript
// Basic capture
{ type: 'click', x: 100, y: 200 }

// With Mark Before grouping
{
  type: 'grouped_action',
  description: 'User intent',
  events: [...],
  duration: 3500
}

// With CDP context
{
  type: 'click',
  coordinates: { x, y },
  element: { selector, xpath, text },
  context: { app, url, title }
}
```

### 4. Self-Activity Filtering
```javascript
const isOwnProcess = activeApp?.name?.includes('Process Capture Studio') || 
                    activeApp?.owner?.name?.includes('Electron');
if (isOwnProcess) return; // Skip capture
```

## IPC Communication Patterns

### Main → Renderer
```javascript
mainWindow.webContents.send('event-name', data);
```

### Renderer → Main (async)
```javascript
const result = await window.electronAPI.invoke('action-name', data);
```

### Main → Worker Process
```javascript
browserWorker.send({ id: uniqueId, type: 'action', data });
```

### Critical IPC Events
- `capture:start/stop` - Recording control
- `mark-before:start` - Intent capture mode (30s window)
- `browser:connect` - CDP connection via worker
- `capture:activity` - Activity data flow

## Testing Patterns

### Jest Configuration
- Environment: Node
- Electron mocking: `/test/mocks/electron.js`
- Coverage excludes renderer (for now)
- Timeout: 10 seconds

### Test Structure
```
test/
├── unit/           # Individual module tests
├── integration/    # Feature flow tests
├── e2e/           # Playwright E2E tests
├── mocks/         # Electron mock
└── utils/         # Test helpers
```

### Running Tests
```bash
npm test                    # All tests
npm test -- --watch        # Watch mode
npm test -- path/to/test   # Specific test
```

## Common Issues & Solutions

### uiohook-napi Build Failure
```bash
npm run rebuild  # Must rebuild after install
# or
npm install --build-from-source
```

### macOS Permissions Required
- System Preferences → Security & Privacy → Accessibility
- Add BOTH Terminal/VS Code AND Electron app

### Browser Context Not Working
1. Click "Launch Capture Browser" first
2. Check worker: `ps aux | grep browser-context-worker`
3. Browser needs `--remote-debugging-port=9222`

### Crypto.randomUUID Polyfill
Already implemented in `app.js`:
```javascript
if (!crypto.randomUUID) {
  crypto.randomUUID = function() { /* polyfill */ };
}
```

## Development Workflow

### Adding New Capture Capability
1. Create service in `src/main/`
2. Add IPC handlers in `main.js`
3. Update data structure in `process-engine.js`
4. Add UI feedback in `activity-tracker.js`
5. Write tests in `test/unit/`

### Debugging Commands
```bash
# Check capture status (DevTools console)
await window.electronAPI.invoke('capture:status')

# Test Mark Before
window.electronAPI.invoke('mark-before:start', 'Test action')

# Check browser worker
ps aux | grep browser-context-worker

# Force rebuild
rm -rf node_modules package-lock.json
npm install && npm run rebuild
```

## Export System

ProcessEngine exports to:
- **JSON** - Complete process data
- **Playwright** - Browser automation
- **Python** - Desktop automation (pyautogui)
- **Markdown** - Documentation
- **Mermaid** - Flowcharts

Export flow:
1. User clicks Export
2. Select format
3. Save dialog
4. File written to chosen location

## Platform-Specific Requirements

### macOS
- Accessibility permission required
- Screen Recording for enhanced capture
- Hardened runtime with entitlements

### Windows
- May need Administrator privileges
- Windows Defender false positive on uiohook-napi

### Linux
- User must be in `input` group
- `sudo usermod -a -G input $USER`
- Logout required after group change

## Global Shortcuts

- `Ctrl/Cmd+Shift+S` - Start/stop capture
- `Ctrl/Cmd+Shift+M` - Mark important step
- `Ctrl/Cmd+E` - Quick export
- `F9` - Toggle window visibility

## Security Notes

- No passwords stored (only marked as credential fields)
- All data local in userData directory
- No cloud connectivity by default
- Process Capture Studio activities auto-filtered
- Browser context runs in isolated process