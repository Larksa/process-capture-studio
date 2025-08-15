# Process Capture Python Service

This Python service extends Process Capture Studio to capture file system operations, Excel interactions, and desktop application events that can't be captured from the browser context.

## Features

- **File System Monitoring**: Tracks file moves, copies, deletes, and modifications
- **Excel Integration**: Captures cell selections, formulas, and sheet navigation (Windows/Mac)
- **Desktop Context**: Identifies active windows and applications
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Real-time Sync**: WebSocket connection to Electron app for instant event relay

## Quick Start

### Automatic Setup (Recommended)
```bash
# From this directory
./start_capture.sh
```

### Manual Setup
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Platform-specific (macOS)
pip install pyobjc-core pyobjc-framework-Quartz py-applescript

# Platform-specific (Windows)
pip install pywin32

# Run the service
python capture_service.py
```

## How It Works

1. **File Monitoring**: Watches Downloads, Desktop, and Documents folders
2. **Event Queue**: All captured events go into a thread-safe queue
3. **WebSocket Bridge**: Connects to Electron app on port 9876
4. **Event Streaming**: Sends formatted events to Electron for display

## Captured Events

### File Operations
- File moved (with source and destination)
- File created
- File deleted
- File modified (Office docs, PDFs, CSVs)

### Excel Operations (when Excel is open)
- Cell selections
- Formula changes
- Sheet navigation
- Workbook switches

### Context Information
- Is file a download?
- Is it on Desktop/Documents?
- Is it in a cloud folder (Dropbox, OneDrive, etc)?
- Parent folder information

## Architecture

```
Python Service (This)
    ↓
WebSocket (Port 9876)
    ↓
Electron Main Process
    ↓
Renderer (Classic UI)
```

## Testing

1. Start the Electron app (Classic UI)
2. Run this Python service
3. Download a file from browser
4. Move it to Documents
5. See both events in activity feed!

## Troubleshooting

- **Permission Denied**: Grant Python access to folders in System Preferences (macOS)
- **Excel Not Found**: Make sure Excel is running before capture
- **Connection Failed**: Check Electron app is running first