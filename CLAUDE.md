# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron-based RPA (Robotic Process Automation) platform that captures user workflows WITH FULL CONTEXT and converts them into automation-ready code. It combines UiPath-level technical capability with AI-powered reasoning capture to understand not just WHAT users do, but WHY they do it.

### Strategic Vision
- **Goal**: Build "UiPath + Business Analyst in One"
- **Differentiator**: Captures business reasoning, not just technical actions
- **Architecture**: Composite approach using best-in-class libraries

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
# Install dependencies
npm install

# Run in development mode (with auto-reload and DevTools)
npm run dev

# Run in production mode
npm start

# Build executables for distribution
npm run build        # Build for current platform
npm run build:win    # Windows executable
npm run build:mac    # macOS app
npm run build:linux  # Linux AppImage
npm run build:all    # All platforms

# Clean project
npm run clean        # Remove dist, builds, node_modules

# Rebuild native modules (if needed)
npm run rebuild
```

## Key Technologies

### Current Stack
- **Electron 27**: Desktop framework
- **uiohook-napi**: System-wide keyboard/mouse capture (basic coordinates only)
- **active-win**: Get active window information
- **electron-builder**: Cross-platform distribution

### Planned Integrations (PRIORITY)
- **Playwright**: Browser automation and selector capture
- **winax/edge-js**: Windows COM for Excel/Office integration  
- **@nut-tree/nut-js**: Cross-platform desktop automation
- **UI Automation API**: Windows native app control identification
- **Anthropic Claude API**: AI-powered reasoning and questioning

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

The ProcessEngine manages nodes with comprehensive automation data:
- **Action details**: Type, description, timestamp
- **Element data**: Selectors, XPath, attributes, position
- **Context**: Application, window, URL, file paths
- **Data flow**: Input sources, output destinations
- **Business logic**: Conditions, reasons, validation rules
- **Branches**: Decision paths and alternatives

## Export Formats

The application can export captured processes to:
- Playwright (browser automation)
- Python (desktop automation with pyautogui)
- Selenium (web testing)
- RPA formats (UiPath/Blue Prism compatible)
- Markdown documentation
- Mermaid flowcharts

## Security Considerations

- Passwords are never stored (marked as credential fields)
- All data stored locally only
- Sensitive data can be blurred/excluded
- No cloud connectivity unless explicitly configured

## Platform-Specific Notes

### macOS
- Requires accessibility permissions for keystroke capture
- May need screen recording permission
- Hardened runtime with entitlements configured

### Windows
- May require running as Administrator for full capture
- Portable and installer versions available

### Linux
- User must be in `input` group for keystroke capture
- AppImage format for easy distribution

## Testing

Currently no automated tests (`npm test` returns placeholder).
Consider adding:
- Unit tests for ProcessEngine
- Integration tests for IPC communication
- E2E tests for capture workflows

## Common Development Tasks

### Adding Context Capture (CRITICAL PATH)
1. **Browser Context**: Integrate Playwright for selector capture
2. **Excel Context**: Use COM automation for cell-level tracking
3. **Desktop Context**: Implement UI Automation API
4. **Enrich Activities**: Transform raw clicks into contextual actions

### Adding New Export Format
1. Extend `ProcessEngine.exportToCode()` in process-engine.js
2. Add format option to export dialog
3. Implement code generation logic
4. Include selector-based automation

### Adding New Capture Type
1. Extend CaptureService to detect new activity
2. **Add context extraction for the activity type**
3. Add handler in main.js IPC
4. Update ProcessEngine node types
5. Add UI representation in activity-tracker.js

### Implementing AI Layer
1. Integrate Claude API client
2. Add context-aware questioning logic
3. Implement pattern recognition
4. Build business rule extraction

## Build Configuration

Configured in package.json `build` section:
- Output directory: `builds/`
- Compression: maximum
- Icons in `assets/` directory
- Platform-specific configurations for Mac, Windows, Linux

## Critical Missing Features (As of 2025-08-10)

### What We Have
- ✅ System-wide click/keystroke capture
- ✅ Application name detection
- ✅ Three-panel UI system
- ✅ Basic process mapping

### What We Need (Priority Order)
1. **Element Selectors**: Full context of WHAT was clicked
2. **Browser Integration**: URLs, DOM elements, form fields
3. **Excel Integration**: Cell addresses, values, formulas
4. **File Paths**: Complete file system context
5. **AI Questioning**: Smart, context-aware prompts

## Architecture Evolution

### Current: Basic Capture
```
Mouse/Keyboard → uiohook → Coordinates → Activity Log
```

### Target: Full Context Capture
```
Mouse/Keyboard → uiohook → Coordinates
                              ↓
                    Context Enrichment Layer
                    ├── Playwright (Browser)
                    ├── COM (Office)
                    ├── UI Automation (Desktop)
                    └── AI Analysis (Reasoning)
                              ↓
                    Rich Contextual Activity
                              ↓
                    Automation-Ready Export
```