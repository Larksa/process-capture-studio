# Process Capture Studio - Startup Guide

## 🚀 Quick Start (Two Terminal Setup Required)

Process Capture Studio requires **TWO TERMINAL WINDOWS** running simultaneously:

### Terminal 1: Main Electron App
```bash
cd /Users/andrewlarkey/process-capture-studio-app
npm start
# OR for classic UI (recommended):
npm run start:classic
```

### Terminal 2: Python Capture Service
```bash
cd /Users/andrewlarkey/process-capture-studio-app/src/python
./start_capture.sh

# OR if Excel capture is causing issues:
./start_capture_no_excel.sh
```

## 📋 Prerequisites

### Required Software
- Node.js 14+ and npm
- Python 3.8+
- Chromium (automatically installed with Playwright)

### Python Dependencies
```bash
cd src/python
pip3 install -r requirements.txt
# OR manually:
pip3 install pyperclip py-applescript pyobjc-framework-Quartz watchdog websockets
```

## 🎯 First Time Setup

1. **Install Node dependencies**:
   ```bash
   npm install
   npm run rebuild  # CRITICAL for uiohook-napi
   ```

2. **Install Python dependencies**:
   ```bash
   cd src/python
   pip3 install -r requirements.txt
   ```

3. **macOS Permissions** (Required):
   - System Preferences → Security & Privacy → Privacy
   - Add Terminal (or VS Code) to:
     - ✅ Accessibility
     - ✅ Screen Recording
     - ✅ Automation (for Excel capture)

## 🔄 Daily Workflow

### Starting the App
1. Open Terminal 1: Run `npm start` from project root
2. Open Terminal 2: Run `./start_capture.sh` from `src/python`
3. Click "Connect Browser" in the app
4. Start capturing!

### Connecting Browser
- Click "🌐 Connect Browser" - launches dedicated Chromium
- Browser shows "🔌 Disconnect Browser" when connected
- Close browser window or click disconnect to stop

### Capturing Workflow
1. **Connect Browser** first for web capture
2. **Start Capture** to begin recording
3. **Mark important steps** with Cmd+Shift+M
4. **Stop** when done
5. **Export** to desired format

## 🛠️ Troubleshooting

### Python Service Issues
```bash
# Check if running:
ps aux | grep capture_service

# Kill if stuck:
pkill -f "python.*capture_service"

# Run without Excel if errors:
./start_capture_no_excel.sh
```

### Browser Connection Issues
- Close all Chrome windows first
- Click "Connect Browser" again
- Check console for errors

### Excel Capture Errors
- Make sure Excel is open with a workbook
- Grant automation permissions to Terminal
- Use `start_capture_no_excel.sh` if persistent

## 📁 Directory Structure
```
process-capture-studio-app/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # UI (HTML/CSS/JS)
│   └── python/         # Python capture service
│       ├── capture_service.py
│       ├── start_capture.sh         # Normal startup
│       └── start_capture_no_excel.sh # Without Excel
├── package.json
└── STARTUP_GUIDE.md    # This file
```

## 🔍 Monitoring

### Check App Status
- Green dot = Browser connected
- Red dot = Browser disconnected
- Activity feed shows all events

### Python Service Logs
Watch Terminal 2 for:
- "✅ Service running"
- "📋 Clipboard" events
- "📊 Excel" selections
- Error messages

## 💡 Tips

1. **Always start Python service first** for best results
2. **Use classic UI** (`npm run start:classic`) for stability
3. **Keep both terminals visible** to monitor status
4. **Disable Excel capture** if you don't need it (saves resources)

## 🆘 Help

- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Check `CLAUDE.md` for development tips
- Review `PROJECT_REQUIREMENTS.md` for feature status

---

*Last Updated: 2025-08-19 4:40 PM*
*Successfully tested with ActiveCampaign contact creation!*