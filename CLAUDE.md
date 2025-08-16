# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron app that captures user workflows WITH context and converts them to automation code. Key differentiator: captures WHY users do things, not just WHAT they do, and captures actual data values for true repeatability.

## Development Commands

```bash
# Setup (CRITICAL if uiohook-napi fails)
npm install && npm run rebuild

# Run Application
npm start                # Classic UI (stable, default)
npm start:modern         # Modern terminal UI (experimental)
npm run dev              # Development mode with auto-reload

# Python Service (run in separate terminal)
cd src/python
./start_capture.sh       # Starts file, clipboard, Excel monitoring

# Testing
npm test                 # All tests using Jest
npm test:watch           # Watch mode for TDD
npm test:coverage        # Generate coverage report
npm test -- test/unit/mark-before-handler.test.js  # Single test file
npm test:e2e            # Playwright end-to-end tests
python3 test_excel_capture.py  # Test Excel capture

# Build & Distribution
npm run build           # Current platform
npm run build:mac       # macOS .dmg (x64 + arm64)
npm run build:win       # Windows .exe + portable
npm run build:linux     # Linux AppImage + deb
npm run build:all       # All platforms
npm run dist            # Build without publishing

# Maintenance
npm run clean           # Remove dist, builds, node_modules
npm run rebuild         # Rebuild native dependencies (uiohook-napi)
```

## Critical Architecture: Four-Process Model with Python Service

The app uses FOUR separate processes for complete capture:

```
Main Process (main.js) → spawns → Browser Worker (browser-context-worker.js)
     ↓                                    ↓
     ↓                              Playwright CDP Operations
     ↓
Python Service (capture_service.py) → WebSocket (port 9876) → Main Process
     ↓
File System + Clipboard + Excel Monitoring
```

### Data Flow & Global Event Buffer
```
Browser Events → Browser Worker → Main Process → Global Event Buffer
Python Events → WebSocket → Python Bridge → Global Event Buffer
                                                        ↓
                                            Export (all events combined)
```

The **Global Event Buffer** in `capture-service.js` is the single source of truth containing all captured events in chronological order.

## Key Files & Their Responsibilities

### Main Process (`src/main/`)
- `main.js` - Electron app lifecycle, window management, IPC coordinator
- `capture-service.js` - Global event buffer, capture orchestration
- `browser-context-worker.js` - Forked process for Playwright CDP operations
- `browser-context-service.js` - Browser context enrichment, session management
- `python-bridge.js` - WebSocket server for Python service communication
- `replay-engine.js` - Executes captured automations for validation (NEW)
- `mark-before-handler.js` - Intent capture (Cmd+Shift+M) handling
- `step-boundary-handler.js` - Groups events into logical steps
- `window-manager.js` - Multi-window management, positioning
- `preload.js` - Secure bridge between renderer and main process

### Renderer Process (`src/renderer/`)
- `index.html` - Classic UI (default, stable)
- `modern.html` - Modern terminal UI (experimental)
- `js/app.js` - Classic UI main application logic
- `js/modern-app.js` - Modern terminal-style UI logic
- `js/process-engine.js` - Export generation (Playwright, Python, JSON, JSON-Replay)
- `js/replay-controller.js` - Replay Center UI management (NEW)
- `js/activity-tracker.js` - Activity panel updates
- `js/chat-guide.js` - Guide panel interactions
- `js/workflow-analyzer.js` - Pattern detection, loop recognition

### Python Service (`src/python/`)
- `capture_service.py` - Main Python service, coordinates monitors
- `clipboard_monitor.py` - Cross-platform clipboard monitoring
- `start_capture.sh` - Shell script to start Python service
- `requirements.txt` - Python dependencies

## Recent Features

### Replay Automation (feature/replay-automation-button branch)
- **Replay Engine**: Simulates captured automations for validation
- **Replay Center**: Replaced Process Map panel with functional replay controls
- **Rich Context Display**: Shows button names, file names instead of coordinates
- **Multiple speeds**: 0.5x, 1x, 2x, 5x replay with step-through mode

### JSON Replay Strategy Export (NEW)
- Enhanced JSON export with replay strategies per event
- Primary, secondary, and fallback automation methods
- Confidence scores for each method
- Application-specific hints (COM automation, AppleScript)
- Window-relative coordinates where applicable

## Core Capture Capabilities

### 1. Browser Context (via Playwright CDP)
- DOM selectors (CSS, XPath, ID)
- Element attributes and text
- Page URL and title
- Session state (cookies, localStorage)

### 2. System Events (via uiohook-napi)
- Global keystrokes and mouse clicks
- Application context (active window)
- Coordinates and timing

### 3. Data Capture (via Python Service)
- **Clipboard monitoring**: Captures actual content with source
- **Excel integration**: Cell values, formulas, addresses (A1:B1)
- **File operations**: Create, move, delete with full paths
- **Document context**: Knows which app, document, location

### 4. Intent Capture (Mark Before Pattern)
```javascript
// User presses Cmd+Shift+M → Dialog appears
// User types intent → System captures next 30s
markBeforeHandler.startMarkMode(description);
// Groups all events under single intent node
```

### 5. Browser Session Persistence
```javascript
// Capture authenticated state (cookies, localStorage, sessionStorage)
const sessionState = await browserContextService.saveSession();
// Session state embedded in exports for replay

// Replay bypasses login
await browser.newContext({ storageState: sessionState });
```

## Critical Implementation Details

### Worker Communication Pattern
```javascript
// Main spawns worker with unique request IDs
browserWorker = fork(path.join(__dirname, 'browser-context-worker.js'));
const requestId = Date.now().toString();
browserWorkerRequests.set(requestId, { resolve, reject });
browserWorker.send({ id: requestId, type: 'action', data });
```

### Python Bridge WebSocket
```javascript
// Python service connects on port 9876
pythonBridge = new PythonBridge();
pythonBridge.start(captureService);
// Events flow: Python → WebSocket → Main → Global Buffer
// IMPORTANT: Use sendToPython() not send()
pythonBridge.sendToPython(message);
```

### Self-Activity Filtering
```javascript
// CRITICAL: Filter out Process Capture Studio's own events
const isOwnProcess = activeApp?.name?.includes('Process Capture Studio') || 
                    activeApp?.owner?.name?.includes('Electron');
if (isOwnProcess) return; // Skip capture
```

### Coordinate Extraction Pattern
```javascript
// Events may store coordinates in different locations
const x = event.x !== undefined ? event.x : 
          (event.position?.x !== undefined ? event.position.x : 'unknown');
const y = event.y !== undefined ? event.y : 
          (event.position?.y !== undefined ? event.position.y : 'unknown');
```

## IPC Event Flow

Critical channels:
- `capture:start/stop` → Recording control
- `capture:activity` → Browser/system events
- `capture:python-event` → Python service events
- `mark-before:start` → Intent capture
- `browser:connect` → CDP connection
- `browser:saveSession` → Capture auth state
- `session:capture/load` → Session management
- `step:start/end` → Step boundary grouping
- `replay:start/stop/pause/resume` → Replay control (NEW)
- `replay:status` → Replay status updates (NEW)
- `replay:log` → Replay log entries (NEW)

## Export System

ProcessEngine generates different formats based on captured data:
- **JSON** → Complete data structure
- **JSON Replay Strategy** → Enhanced JSON with replay methods and confidence scores (NEW)
- **Playwright/Puppeteer** → Web with DOM selectors + embedded session state
- **Python/pyautogui** → Desktop apps, file operations
- **Selenium** → Cross-browser testing format
- **Raw Log** → Complete capture with all context (debugging)
- **YAML** → Human-readable structured format
- **Mermaid** → Diagram markdown
- **Markdown/Plain Text** → Documentation formats

### Export Format Selection
```javascript
// In process-engine.js exportForAutomation()
switch (format) {
    case 'json': return JSON.stringify(exportData, null, 2);
    case 'json-replay': return this.generateJSONReplayStrategy(exportData);
    case 'playwright': return this.generatePlaywrightCode();
    // ... other formats
}
```

## Common Issues & Solutions

### uiohook-napi Build Failure
```bash
npm run rebuild  # MUST run after npm install
# If still failing:
npm install -g node-gyp
npm run rebuild
```

### macOS Permissions
- System Preferences → Security & Privacy → Accessibility
- Add BOTH Terminal/VS Code AND Electron app
- Python service needs folder access permissions

### Python Service Not Capturing
1. Check if running: `ps aux | grep capture_service`
2. Install dependencies: `pip install -r src/python/requirements.txt`
3. macOS specific: `pip install pyobjc-core py-applescript`
4. Check WebSocket connection on port 9876

### Browser Context Missing
- Check worker process: `ps aux | grep browser-context-worker`
- Verify Step Boundary Handler connected to global buffer
- Check terminal for "📌 Storing enriched event" messages

### Excel Values Not Captured
- Excel must be running before Python service starts
- On macOS: Grant automation permissions for Terminal
- Check for "📊 Excel: Selected" messages in Python terminal

### Replay Not Showing Context
- Ensure browser worker is initialized
- Check that events have element.selectors populated
- Verify Python bridge is using sendToPython() method

## Testing Approach

```javascript
// Jest configuration in jest.config.js
// Electron APIs mocked in test/mocks/electron.js

// Run tests
npm test                    // All tests
npm test -- --watch        // Watch mode
npm test -- path/to/test   // Single test file
npm test:coverage          // Coverage report

// Test structure
test/
├── unit/                  // Unit tests
├── integration/           // Integration tests
└── mocks/                 // Mock implementations
```

## Platform-Specific Notes

### macOS
- Accessibility + Screen Recording permissions required
- AppleScript for Excel integration
- Quartz for window management
- May need to grant automation permissions for Terminal

### Windows
- May need Administrator for some apps
- pywin32 for Excel COM automation
- Windows Defender may flag uiohook-napi
- Use portable build for no-install distribution

### Linux
- User must be in `input` group: `sudo usermod -a -G input $USER`
- Limited Excel support (LibreOffice only)
- X11 or Wayland considerations for screen capture

## Multi-Monitor Considerations

- Captures absolute coordinates across all monitors
- Browser selectors are monitor-independent (preferred)
- For best results, record on single monitor
- Replay may need same monitor configuration for coordinate-based actions

## Security Considerations

- NO passwords stored (only marks credential fields)
- Clipboard content limited to 1000 chars in storage
- Session state contains auth tokens - handle as passwords
- Cookies and localStorage captured - treat exports securely
- Excel formulas captured but not evaluated
- Self-activity filtered to prevent recursion

### Session Security Warning
Session files allow bypassing login on replay. Store exports securely and never commit session state to version control.

## Build Configuration

The app uses electron-builder with the following output structure:
```
builds/
├── mac/
│   ├── ProcessCaptureStudio.dmg (universal binary)
│   └── ProcessCaptureStudio.zip
├── win/
│   ├── ProcessCaptureStudio-Setup.exe (installer)
│   └── ProcessCaptureStudio-Portable.exe
└── linux/
    ├── ProcessCaptureStudio.AppImage
    └── ProcessCaptureStudio.deb
```

Build configuration is in `package.json` under the `build` key.

## Git Workflow

Current active branch: `feature/replay-automation-button`
- Contains replay functionality and JSON Replay Strategy export
- Not yet merged to main

To switch between branches:
```bash
git checkout main                             # Stable version
git checkout feature/replay-automation-button # Latest features
```