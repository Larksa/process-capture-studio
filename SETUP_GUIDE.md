# Process Capture Studio - Setup Guide for Colleagues

## 🎯 Overview
Process Capture Studio is an Electron app that captures user workflows with context and converts them to automation code. It captures not just WHAT you do, but WHY you do it.

## 📋 Prerequisites

### Required:
- **Node.js** 16.0.0 or higher ([Download](https://nodejs.org/))
- **npm** 8.0.0 or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

### Optional (for advanced features):
- **Python** 3.8+ ([Download](https://python.org/))
- **Excel** (for Excel automation capture)

## 🚀 Installation Steps

### Step 1: Clone the Repository
```bash
git clone https://github.com/Larksa/process-capture-studio.git
cd process-capture-studio
```

### Step 2: Run Setup Script (Recommended)
```bash
# For Mac/Linux:
./setup.sh

# For Windows (in Git Bash or WSL):
bash setup.sh

# Or manually:
npm install && npm run rebuild
```

### Step 3: Start the Application
```bash
# Classic UI (stable)
npm start

# Modern terminal UI (experimental)
npm start:modern

# Development mode with auto-reload
npm run dev
```

## 🔧 Platform-Specific Setup

### macOS 🍎
1. **Grant Permissions** (REQUIRED):
   - System Preferences → Security & Privacy → Privacy
   - Add Terminal (or VS Code) to:
     - ✅ Accessibility
     - ✅ Screen Recording
     - ✅ Input Monitoring

2. **For Excel Capture** (optional):
   ```bash
   pip3 install pyobjc-core pyobjc-framework-Quartz py-applescript
   ```

### Windows 🪟
1. **Run as Administrator** (recommended for full functionality)
2. **For Excel Capture** (optional):
   ```bash
   pip install pywin32
   ```
3. **If Windows Defender blocks the app**:
   - Click "More info" → "Run anyway"

### Linux 🐧
1. **Add user to input group**:
   ```bash
   sudo usermod -a -G input $USER
   # Log out and back in for changes to take effect
   ```
2. **Install dependencies**:
   ```bash
   sudo apt-get install libx11-dev libxkbfile-dev
   ```

## 🎮 How to Use

### Basic Workflow:
1. **Start Recording**: Press `Ctrl+Shift+S` or click "Start Capture"
2. **Mark Important Steps**: Press `Ctrl+Shift+M` and describe what you're doing
3. **Stop Recording**: Press `Ctrl+Shift+S` again
4. **Export**: Choose your format (Playwright, Python, JSON, etc.)

### Keyboard Shortcuts:
- `Ctrl+Shift+S` - Start/Stop recording
- `Ctrl+Shift+M` - Mark important step
- `Ctrl+E` - Quick export
- `F9` - Toggle window

## 🐛 Troubleshooting

### "Cannot find module 'uiohook-napi'"
```bash
npm run rebuild
```

### "Permission denied" on macOS
- Grant accessibility permissions in System Preferences
- Run from Terminal instead of double-clicking

### Python Service Not Working
```bash
cd src/python
pip install -r requirements.txt
./start_capture.sh
```

### App Crashes on Start
```bash
# Clear cache and rebuild
rm -rf node_modules
npm install
npm run rebuild
```

## 🚀 Advanced Features

### Running Python Capture Service
For clipboard, file system, and Excel monitoring:
```bash
# In a separate terminal:
cd src/python
./start_capture.sh
```

### Browser Session Capture
1. Click "🌐 Launch Capture Browser"
2. Login to your web application
3. Click "🍪 Capture Session"
4. Continue recording with authentication saved

## 📚 Additional Resources

- **Full Documentation**: See [README.md](README.md)
- **Architecture Overview**: See [CLAUDE.md](CLAUDE.md)
- **Report Issues**: [GitHub Issues](https://github.com/Larksa/process-capture-studio/issues)

## 💡 Tips for First-Time Users

1. **Start Simple**: Try recording a basic workflow first
2. **Use Mark Before**: Press Ctrl+Shift+M to explain WHY you're doing something
3. **Test Export**: Export to JSON first to see what's captured
4. **Check Permissions**: Most issues are permission-related

## 🤝 Need Help?

1. Check the troubleshooting section above
2. Look at existing [GitHub Issues](https://github.com/Larksa/process-capture-studio/issues)
3. Create a new issue with:
   - Your OS and version
   - Node.js version (`node -v`)
   - Error messages
   - Steps to reproduce

## 🎉 Ready to Start!

You're all set! Start the app with `npm start` and begin capturing your workflows.

Remember: This tool captures WHAT you do and WHY you do it - making your processes truly repeatable and automatable!