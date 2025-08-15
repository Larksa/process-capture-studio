# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron app that captures user workflows WITH context and converts them to automation code. Key differentiator: captures WHY users do things, not just WHAT they do.

## Critical Architecture: Three-Process Model

The app uses THREE separate processes to avoid Electron async conflicts:

```
Main Process (main.js) → spawns → Browser Worker (browser-context-worker.js)
     ↓                                    ↓
Renderer Process                    Playwright CDP Operations
```

### Worker Communication Pattern
```javascript
// Main spawns worker
browserWorker = fork(path.join(__dirname, 'browser-context-worker.js'));

// Request with unique ID
const requestId = Date.now().toString();
browserWorkerRequests.set(requestId, { resolve, reject });
browserWorker.send({ id: requestId, type: 'action', data });

// Worker responds
process.on('message', ({ id, result, error }) => {
  const request = browserWorkerRequests.get(id);
  if (request) {
    error ? request.reject(error) : request.resolve(result);
    browserWorkerRequests.delete(id);
  }
});
```

## Development Commands

```bash
# Setup (CRITICAL if uiohook-napi fails)
npm install && npm run rebuild

# Development
npm run dev              # Dev mode with auto-reload
npm start                # Production mode
npm start:modern         # New terminal UI (experimental)

# Testing
npm test                 # All tests
npm test -- test/unit/mark-before-handler.test.js  # Single test
npm test:watch          # Watch mode
npm test:coverage       # Coverage report

# Build
npm run build           # Current platform
npm run build:mac       # macOS .dmg
npm run build:win       # Windows .exe
npm run build:linux     # Linux AppImage
```

## Core Patterns

### 1. Mark Before Pattern (Intent-First Capture)
User declares intent BEFORE performing actions:
```javascript
// User presses Cmd+Shift+M → Dialog appears
// User types intent → System captures next 30s of activity
markBeforeHandler.startMarkMode(description);
// Groups all events under single intent node
```

### 2. Activity Data Structure Evolution
```javascript
// Level 1: Basic capture
{ type: 'click', x: 100, y: 200 }

// Level 2: With browser context (via CDP)
{
  type: 'click',
  coordinates: { x, y },
  element: { selector: '#button', xpath: '//button[@id="submit"]' },
  context: { url, title, app }
}

// Level 3: With Mark Before grouping
{
  type: 'grouped_action',
  description: 'Submit customer form',
  events: [...nested events with full context...],
  duration: 3500
}
```

### 3. Self-Activity Filtering (Critical)
```javascript
// Must filter out Process Capture Studio's own clicks
const isOwnProcess = activeApp?.name?.includes('Process Capture Studio') || 
                    activeApp?.owner?.name?.includes('Electron');
if (isOwnProcess) return; // Skip capture
```

### 4. Browser Session Persistence
```javascript
// Capture authenticated state
const sessionState = await browserContextService.saveSession();
// Includes cookies, localStorage, sessionStorage

// Replay with auth
await browserContextService.loadSession(sessionState);
```

## IPC Event Flow

Critical IPC channels:
- `capture:start/stop` → Recording control
- `mark-before:start` → Intent capture (30s window)
- `browser:connect` → CDP via worker process
- `browser:saveSession` → Capture auth state
- `capture:activity` → Activity data stream

## Export System

ProcessEngine generates different formats for different needs:
- **Playwright/Puppeteer** → Web automation with DOM selectors
- **Python/pyautogui** → Desktop apps, cross-application workflows
- **Selenium** → Enterprise standard
- **JSON** → Complete process data with context
- **Markdown** → Human documentation

## Common Issues & Solutions

### uiohook-napi Build Failure
```bash
npm run rebuild  # MUST run after npm install
```

### macOS Permissions
System Preferences → Security & Privacy → Accessibility
Add BOTH Terminal/VS Code AND Electron app

### Browser Context Not Working
1. Click "Launch Capture Browser" first
2. Check worker: `ps aux | grep browser-context-worker`
3. Browser needs `--remote-debugging-port=9222`

### EPIPE Errors
Already handled in main.js - ignores broken worker connections gracefully

## Testing Strategy

Jest with Electron mocking:
```javascript
// test/mocks/electron.js provides fake Electron APIs
// Tests run in Node environment
// Coverage excludes renderer (for now)
```

## Platform Requirements

### macOS
- Accessibility permission required
- Screen Recording permission for enhanced capture

### Windows  
- May need Administrator for some apps
- Windows Defender may flag uiohook-napi

### Linux
- User must be in `input` group: `sudo usermod -a -G input $USER`

## Security Considerations

- NO passwords stored (only marks credential fields)
- All data local in userData directory
- Session files contain auth tokens - treat as passwords
- Process Capture Studio activities auto-filtered
- Browser runs in isolated worker process