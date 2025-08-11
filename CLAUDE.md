# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron-based RPA platform that captures user workflows WITH FULL CONTEXT and converts them into automation-ready code. It captures not just WHAT users do, but WHY they do it - combining UiPath-level technical capability with AI-powered reasoning capture.

## Architecture

### Main Process (`src/main/`)
- **main.js**: Application lifecycle, window management, IPC handlers, global shortcuts
- **capture-service.js**: System-wide activity capture using uiohook-napi
- **window-manager.js**: Window state and behavior management
- **preload.js**: Bridge between main and renderer processes

### Renderer Process (`src/renderer/`)
- **app.js**: Main UI controller and state management
- **activity-tracker.js**: Displays captured activities in real-time
- **chat-guide.js**: Interactive guide that asks for context and reasons
- **process-engine.js**: Core data model for process nodes, branches, and automation export
- **canvas-builder.js**: Visual process map rendering using Canvas API

### Key Communication Patterns
- Main → Renderer: `mainWindow.webContents.send('event-name', data)`
- Renderer → Main: `window.electronAPI.invoke('action-name', data)`
- Activity flow: CaptureService → Main → Renderer → UI Components

## Development Commands

```bash
# Install and setup
npm install              # Install dependencies
npm run rebuild          # Rebuild native modules (if uiohook-napi fails)

# Development
npm run dev              # Development mode with auto-reload and DevTools
npm start                # Production mode

# Building
npm run build            # Build for current platform
npm run build:win        # Windows executable
npm run build:mac        # macOS app
npm run build:linux      # Linux AppImage
npm run build:all        # All platforms

# Testing (placeholder - no tests yet)
npm test

# Cleanup
npm run clean            # Remove dist, builds, node_modules
```

## Key Technologies

### Current Stack
- **Electron 27**: Desktop framework
- **uiohook-napi**: System-wide keyboard/mouse capture (coordinates only)
- **active-win**: Active window information
- **playwright**: Installed but not yet integrated for browser context

### Critical Missing Context (TOP PRIORITY)
1. **Element Selectors**: Currently captures coordinates only, needs DOM/UI element context
2. **Browser Integration**: Playwright integration for URLs, DOM elements, form fields
3. **Excel/Office Integration**: COM automation for cell-level tracking
4. **File System Context**: Complete file paths and operations
5. **AI Reasoning**: Claude API for intelligent questioning

## Global Shortcuts

- `Ctrl+Shift+S` / `Cmd+Shift+S`: Start/stop capture
- `Ctrl+Shift+M` / `Cmd+Shift+M`: Mark important step
- `Ctrl+E` / `Cmd+E`: Quick export
- `F9`: Toggle window visibility

## IPC Events

### Main Process Handles
- `capture:start/stop`: Control recording
- `capture:mark`: Mark important moments
- `window:always-on-top`: Window pinning
- `window:opacity`: Transparency control
- `system:get-active-app`: Current application info
- `export:save-file`: Save dialog and file writing

### Renderer Receives
- `capture:activity`: New activity data
- `shortcut:mark-important`: Global shortcut triggered
- `shortcut:toggle-capture`: Start/stop from shortcut
- `shortcut:export`: Quick export triggered

## Process Data Model

ProcessEngine manages nodes with:
- **Action details**: Type, description, timestamp
- **Element data**: Selectors, XPath, attributes, position (planned)
- **Context**: Application, window, URL, file paths
- **Business logic**: Conditions, reasons, validation rules
- **Branches**: Decision paths and alternatives

## Export Formats

Currently supports export to:
- Playwright (browser automation)
- Python (desktop automation with pyautogui)
- Selenium (web testing)
- RPA formats (UiPath/Blue Prism compatible)
- Markdown documentation
- Mermaid flowcharts

## Critical Path Development Tasks

### 1. Add Browser Context Capture (URGENT)
```javascript
// In capture-service.js, integrate Playwright for browser context
// Example: When click detected, if browser window:
// 1. Connect to browser via CDP
// 2. Get element selector at click coordinates
// 3. Capture DOM attributes, text, URL
```

### 2. Implement Element Selector Capture
```javascript
// Transform raw coordinates to actionable selectors:
// Windows: UI Automation API
// Mac: Accessibility API
// Linux: AT-SPI
// Browser: Playwright selectors
```

### 3. Add Excel/Office Integration
```javascript
// Use winax or edge-js for COM automation
// Capture: Cell address, formula, value, sheet name
// Track: Copy sources, paste destinations
```

### 4. Enrich Activity Data
Current activity structure needs enhancement:
```javascript
// FROM (current):
{ type: 'click', x: 100, y: 200, app: 'Chrome' }

// TO (needed):
{
  type: 'click',
  coordinates: { x: 100, y: 200 },
  element: {
    selector: '#submit-button',
    xpath: '//button[@id="submit-button"]',
    text: 'Submit Order',
    attributes: { id: 'submit-button', class: 'btn-primary' }
  },
  context: {
    app: 'Chrome',
    url: 'https://example.com/orders',
    title: 'Order Management'
  },
  businessContext: 'Submitting customer order after validation'
}
```

## Platform-Specific Notes

### macOS
- Requires accessibility permissions (System Preferences → Security → Privacy)
- May need screen recording permission
- Hardened runtime with entitlements configured

### Windows
- May require Administrator privileges for full capture
- COM automation needed for Office integration

### Linux
- User must be in `input` group for keystroke capture
- AppImage format for distribution

## Known Issues & Workarounds

1. **uiohook-napi fails to build**: Run `npm run rebuild`
2. **Keystrokes not captured on Mac**: Check accessibility permissions
3. **Canvas performance with many nodes**: Implement virtualization (planned)

## Architecture Evolution Path

### Current State (v1.0)
```
Mouse/Keyboard → uiohook → Coordinates → Basic Activity Log
```

### Next Milestone (v1.1)
```
Mouse/Keyboard → uiohook → Coordinates
                              ↓
                    Context Enrichment Layer
                    ├── Playwright (Browser)
                    ├── Active Window (Desktop)
                    └── Basic AI Prompting
                              ↓
                    Contextual Activity Log
```

### Target Architecture (v2.0)
```
User Action → Multi-Source Capture
                    ↓
            Context Enrichment Layer
            ├── Playwright (Browser DOM)
            ├── COM (Office Integration)
            ├── UI Automation (Desktop Apps)
            └── Claude AI (Reasoning & Intelligence)
                    ↓
            Rich Contextual Process Model
                    ↓
            Automation-Ready Export
            ├── Executable Code
            ├── Documentation
            └── Test Scripts
```

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

# Force rebuild native modules
rm -rf node_modules && npm install && npm run rebuild
```

## Security Considerations

- Passwords are never stored (marked as credential fields only)
- All data stored locally in app's userData directory
- No cloud connectivity unless explicitly configured
- Sensitive data can be blurred/excluded from capture