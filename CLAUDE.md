# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Process Capture Studio is an Electron-based desktop application that captures user workflows and converts them into automation-ready code. It uses a three-panel system to track activities, capture decision logic, and build visual process maps.

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

- **Electron 27**: Desktop framework
- **uiohook-napi**: System-wide keyboard/mouse capture (requires rebuilding for Electron)
- **active-win**: Get active window information
- **electron-builder**: Cross-platform distribution

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

### Adding New Export Format
1. Extend `ProcessEngine.exportToCode()` in process-engine.js
2. Add format option to export dialog
3. Implement code generation logic

### Adding New Capture Type
1. Extend CaptureService to detect new activity
2. Add handler in main.js IPC
3. Update ProcessEngine node types
4. Add UI representation in activity-tracker.js

### Modifying UI Layout
1. Edit src/renderer/index.html for structure
2. Update src/renderer/css/styles.css for styling
3. Adjust panel behaviors in app.js

## Build Configuration

Configured in package.json `build` section:
- Output directory: `builds/`
- Compression: maximum
- Icons in `assets/` directory
- Platform-specific configurations for Mac, Windows, Linux