# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron app that captures user workflows WITH context and converts them to automation code. Key differentiator: captures WHY users do things, not just WHAT they do, and captures actual data values for true repeatability.

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

## Development Commands

```bash
# Setup (CRITICAL if uiohook-napi fails)
npm install && npm run rebuild

# Electron App
npm start                # Classic UI (stable)
npm start:modern         # Modern terminal UI (experimental)
npm run dev              # Development mode with auto-reload

# Python Service (run in separate terminal)
cd src/python
./start_capture.sh       # Starts file, clipboard, Excel monitoring

# Testing
npm test                 # All tests
npm test -- test/unit/mark-before-handler.test.js  # Single test
python3 test_excel_capture.py  # Test Excel capture

# Build
npm run build           # Current platform
npm run build:mac       # macOS .dmg
npm run build:win       # Windows .exe
npm run build:linux     # Linux AppImage
```

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

### 3. Data Capture (via Python Service) - NEW
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
```

### Data Structure Evolution
```javascript
// Level 1: Basic click
{ type: 'click', x: 100, y: 200 }

// Level 2: With browser context
{
  type: 'click',
  element: { 
    selectors: { css: '#submit', xpath: '//button[@id="submit"]' },
    attributes: { name: 'submitBtn', type: 'submit' }
  },
  pageContext: { url: 'example.com', title: 'Form' }
}

// Level 3: With clipboard data
{
  type: 'clipboard_copy',
  content: 'John Smith',
  source: { 
    application: 'Microsoft Excel',
    excel_selection: { 
      address: '$A$1:$B$1',
      sheet: 'Sheet1',
      workbook: 'data.xlsx'
    }
  }
}
```

### Self-Activity Filtering
```javascript
// CRITICAL: Filter out Process Capture Studio's own events
const isOwnProcess = activeApp?.name?.includes('Process Capture Studio') || 
                    activeApp?.owner?.name?.includes('Electron');
if (isOwnProcess) return; // Skip capture
```

## Export System

ProcessEngine generates different formats based on captured data:
- **Playwright/Puppeteer** → Web with DOM selectors + embedded session state (cookies, localStorage)
- **Python/pyautogui** → Desktop apps, file operations
- **Raw Log** → Complete capture with all context (debugging)
- **JSON** → Structured data with Excel values, clipboard content, session state
- **With Data Extraction** → Reads from source files (Excel, Word)

### Session State in Exports
```javascript
// Exports include authentication state
{
  sessionState: {
    cookies: [...],      // All cookies from captured domains
    localStorage: [...], // Site storage
    sessionStorage: [...] // Temporary storage
  },
  metadata: {
    capturedAt: "2024-01-15T10:30:00Z",
    hasAuthentication: true,
    domains: ["example.com", "api.example.com"]
  }
}
```

## Common Issues & Solutions

### uiohook-napi Build Failure
```bash
npm run rebuild  # MUST run after npm install
```

### macOS Permissions
- System Preferences → Security & Privacy → Accessibility
- Add BOTH Terminal/VS Code AND Electron app
- Python service needs folder access permissions

### Python Service Not Capturing
1. Check if running: `ps aux | grep capture_service`
2. Install dependencies: `pip install -r requirements.txt`
3. macOS specific: `pip install pyobjc-core py-applescript`

### Browser Context Missing
- Check worker process: `ps aux | grep browser-context-worker`
- Verify Step Boundary Handler connected to global buffer
- Check terminal for "📌 Storing enriched event" messages

### Excel Values Not Captured
- Excel must be running before Python service starts
- On macOS: Grant automation permissions for Terminal
- Check for "📊 Excel: Selected" messages in Python terminal

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

## Testing Approach

```javascript
// Jest with Electron mocking
// test/mocks/electron.js provides fake Electron APIs
// Run single test: npm test -- path/to/test.js
```

## Platform-Specific Notes

### macOS
- Accessibility + Screen Recording permissions required
- AppleScript for Excel integration
- Quartz for window management

### Windows
- May need Administrator for some apps
- pywin32 for Excel COM automation
- Windows Defender may flag uiohook-napi

### Linux
- User must be in `input` group
- Limited Excel support (LibreOffice only)

## Security Considerations

- NO passwords stored (only marks credential fields)
- Clipboard content limited to 1000 chars in storage
- Session state contains auth tokens - handle as passwords
- Cookies and localStorage captured - treat exports securely
- Excel formulas captured but not evaluated
- Self-activity filtered to prevent recursion

### Session Security Warning
Session files allow bypassing login on replay. Store exports securely and never commit session state to version control.