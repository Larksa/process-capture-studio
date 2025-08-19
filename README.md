# 🎯 Process Capture Studio

> **The magic three-panel system that captures every keystroke, every decision, and most importantly - every "why"**

Transform how you document and automate business processes. Watch your workflow build visually as you work, capturing not just what you do, but why you do it - ready for instant automation.

## 🚀 Quick Start for Colleagues

**⚠️ IMPORTANT: Requires TWO terminal windows running simultaneously!**

### Terminal 1: Main Application
```bash
# Clone the repository
git clone https://github.com/andrewlarkey/process-capture-studio.git
cd process-capture-studio

# Install dependencies and rebuild native modules
npm install && npm run rebuild

# Start the application (recommended: classic UI)
npm run start:classic
# OR: npm start
```

### Terminal 2: Python Capture Service
```bash
# In a NEW terminal window
cd process-capture-studio/src/python

# Install Python dependencies (first time only)
pip3 install -r requirements.txt

# Start the capture service
./start_capture.sh
# OR if Excel causes issues: ./start_capture_no_excel.sh
```

**Prerequisites:**
- Node.js 16+ and npm 8+
- Python 3.8+ (for advanced capture features)
- macOS: Grant accessibility permissions when prompted
- Windows: May need to run as Administrator

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 📚 GitHub Workflow Guide

For developers new to GitHub collaboration, see our [GitHub Workflow Example](#github-workflow-example) below.

## 🌟 The Revolution

Stop recording steps. Start capturing intelligence.

**Traditional Process Documentation:**
- ❌ Screenshots and written steps
- ❌ Quickly becomes outdated  
- ❌ Missing the logic and decisions
- ❌ Can't handle variations
- ❌ Developers must interpret and guess

**Process Capture Studio:**
- ✅ Live visual process map builds as you work
- ✅ Captures the "why" behind every action
- ✅ Handles branching logic (IF this THEN that)
- ✅ Tracks data sources and destinations
- ✅ Exports automation-ready code instantly

## 🎥 See It In Action

```
┌─────────────────────────────────────────────────────────────┐
│                  Process Capture Studio                      │
├──────────────┬──────────────┬──────────────────────────────┤
│  📹 ACTIVITY │  💬 GUIDE    │  🗺️ PROCESS MAP              │
│              │              │                               │
│  10:23:15    │  Why did you │     [Start]                  │
│  ▶ Click     │  click       │        ↓                     │
│    "Search"  │  Search?     │    [Search Customer]         │
│              │              │        ↓                     │
│  10:23:18    │  Where does  │    {Customer Exists?}        │
│  ⌨ Type      │  the customer│      ↙         ↘            │
│    "Smith"   │  name come   │   [Update]   [Create New]    │
│              │  from?       │      ↘         ↙            │
│  10:23:22    │              │       [Save]                 │
│  📋 Copy     │  ← Email     │         ↓                    │
│    from Excel│              │      [Send Email]            │
└──────────────┴──────────────┴──────────────────────────────┘
```

## 🚀 Quick Start

### Option 1: Download & Run (Easiest)

1. **Download for your platform:**
   - [Windows](https://github.com/yourusername/process-capture-studio/releases/download/v1.0.0/ProcessCaptureStudio-Windows.exe) (75MB)
   - [Mac](https://github.com/yourusername/process-capture-studio/releases/download/v1.0.0/ProcessCaptureStudio-Mac.dmg) (82MB)
   - [Linux](https://github.com/yourusername/process-capture-studio/releases/download/v1.0.0/ProcessCaptureStudio-Linux.AppImage) (78MB)

2. **Run the app** (no installation needed!)

3. **Start capturing:**
   - Press `Start Capture` or `Ctrl+Shift+S`
   - Do your normal work
   - Press `Ctrl+Shift+M` to mark important steps
   - Watch your process build visually!

### Option 2: Run from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/process-capture-studio.git
cd process-capture-studio-app

# Install dependencies
npm install

# Run the app
npm start

# Build portable executable
npm run build
```

## 🎯 Core Features

### 🔍 Complete Capture
- **Browser Activity**: Every click, form, navigation
- **Desktop Applications**: Excel, Word, Outlook, any software
- **Keystrokes**: Important key combinations (not passwords!)
- **File Operations**: Which files, where located, what data
- **Cross-Application**: Copy from Excel → Paste to web → Save to file

### 🧠 Intelligence Layer
- **Decision Points**: IF conditions with multiple branches
- **Data Lineage**: Where data comes from and goes
- **Business Rules**: Why actions are taken
- **Validation Logic**: What to check and verify
- **Error Handling**: What to do when things fail

### 🎨 Visual Builder
- **Real-time Canvas**: See your process build live
- **Interactive Nodes**: Click to navigate, drag to reorganize
- **Branching Paths**: Visual IF/THEN/ELSE logic
- **Data Flow Arrows**: See information movement
- **Zoom & Pan**: Handle complex processes easily

### 🤖 Export for Automation
- **Playwright**: Browser automation code with session persistence
- **Python**: Desktop automation scripts
- **Selenium**: Web testing code
- **RPA**: UiPath/Blue Prism compatible
- **Documentation**: Markdown process guides
- **Mermaid**: Flowchart diagrams
- **🍪 Session Persistence**: Capture and replay with authentication intact

## 💡 Use Cases

### 📊 Invoice Processing
Capture the entire workflow:
1. Open email with invoice
2. Save PDF to specific folder
3. Open Excel tracking sheet
4. Copy invoice details
5. Update multiple systems
6. Send confirmation

**Exported as working Python script in seconds!**

### 👤 Customer Onboarding
Document complex multi-system process:
- CRM data entry
- Email verification
- Document generation
- System access setup
- Welcome email sending

**Complete with all decision logic and validation rules!**

### 📈 Report Generation
Capture data gathering from multiple sources:
- Database queries
- Excel manipulations
- Web portal extracts
- Data transformations
- Final report creation

**Including all the "why" and "how" for future automation!**

## 🍪 Session Persistence (Authentication Capture)

Process Capture Studio can capture and replay authenticated sessions, allowing your automations to bypass login screens and work with authenticated applications.

### How It Works
1. **Launch Capture Browser**: Click "🌐 Launch Capture Browser" to start enhanced capture
2. **Login to Your Application**: Navigate and login normally to your target website
3. **Capture Session**: Click "🍪 Capture Session" to save cookies, localStorage, and sessionStorage
4. **Continue Recording**: Record your workflow with authentication already in place
5. **Export with Session**: Your exported automation includes the session state

### Security Warning ⚠️

**Session files contain sensitive authentication data** including:
- Login cookies and tokens
- Session storage data
- Local storage contents
- Authentication headers

**Best Practices:**
- Never commit session data to Git repositories
- Treat exported JSON files as passwords
- Only share with trusted parties
- Sessions expire naturally based on website policies
- Use "Clear Session" to remove stored authentication

### Supported Sites
- GitHub (with 2FA)
- Google Workspace
- Microsoft 365
- Custom enterprise applications
- Any site using cookie-based authentication

### Technical Details
The session persistence uses Playwright's `storageState` API to capture the complete browser state. This includes:
- All cookies with their attributes (httpOnly, secure, sameSite)
- localStorage for all origins
- sessionStorage for all origins
- Works across domains and subdomains

## 🎮 How to Use

### Basic Workflow

#### 1. Start Recording
```
Press: Ctrl+Shift+S or click "Start Capture"
Status: 🔴 Recording appears in top-left
```

#### 2. Mark Important Moments
```
Press: Ctrl+Shift+M at key actions
Popup: "What did you just do?"
Answer: "Copied customer ID from email"
```

#### 3. Handle Decisions
```
When you check something:
System: "What are you checking?"
You: "If customer exists in database"
System: "What are the possible outcomes?"
You: "Exists → Update" or "New → Create"
```

#### 4. Record Each Branch
```
Click the decision node
Select: "Record 'Exists' branch"
Perform those steps
Return and record other branches
```

#### 5. Export Automation
```
Click: Export button
Choose: Playwright / Python / Documentation
Get: Ready-to-run automation code!
```

## 🔀 Advanced Features

### Recursive Data Discovery
When you paste data, the system asks:
- "Where did this come from?"
- "Show me the file" → Records navigation
- "Which cell/field?" → Captures exact location
- Creates complete data lineage

### Credential Handling
Never stores passwords! When detected:
- Creates secure placeholder: `CREDENTIAL_XYZ`
- Asks: "How should automation retrieve this?"
- Options: Prompt, KeyVault, Environment, SSO

### Loop Detection
Recognizes repetitive patterns:
- "Doing this for each row?"
- "Process all files in folder?"
- Automatically creates loop structure

### Time Travel
- Click any node to jump back
- Add missing steps
- Create alternative paths
- Fill gaps in logic

## 🛠️ Configuration

### Settings File
```json
{
  "capture": {
    "autoMarkImportant": true,
    "captureScreenshots": false,
    "blurSensitiveData": true
  },
  "window": {
    "alwaysOnTop": true,
    "opacity": 0.95,
    "position": "top-right"
  },
  "export": {
    "defaultFormat": "playwright",
    "includeComments": true,
    "generateTests": true
  }
}
```

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Start/Stop Recording | `Ctrl+Shift+S` |
| Mark Important Step | `Ctrl+Shift+M` |
| Quick Export | `Ctrl+E` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Toggle Window | `F9` |

## 🚢 Distribution to Team

### For IT Departments

#### 1. No Installation Needed
```bash
# Just copy the executable to a shared drive
\\company-share\tools\ProcessCaptureStudio.exe
```

#### 2. First Run Setup
Users will be prompted to:
- Enable accessibility permissions (Mac)
- Allow screen recording (Mac)
- Run as trusted app (Windows)

#### 3. Central Configuration
```bash
# Deploy settings via GPO or script
copy \\server\config\studio-settings.json %APPDATA%\ProcessCaptureStudio\
```

### For Consultants

Package with your branding:
```bash
# Customize and rebuild
npm run build -- --config your-brand.json
```

Outputs branded executable with your logo and colors.

## 🔐 Security & Privacy

### What We Capture
- ✅ Application names and window titles
- ✅ Element selectors and positions
- ✅ File paths and names
- ✅ Keystroke patterns (not content)

### What We DON'T Capture
- ❌ Passwords (only marks as credential field)
- ❌ Personal data (unless explicitly marked)
- ❌ Screenshots (unless enabled)
- ❌ Background activity (only when recording)

### Data Storage
- **Local Only**: All data stays on your machine
- **Export Control**: You decide what to share
- **No Cloud**: Unless you explicitly configure it

## 📊 System Requirements

### Minimum Requirements
- **OS**: Windows 10, macOS 10.14, Ubuntu 20.04
- **RAM**: 4GB
- **Disk**: 200MB for app, 1GB for captures
- **Display**: 1280x720

### Recommended
- **RAM**: 8GB+ for large processes
- **Display**: 1920x1080 or higher
- **Multi-monitor**: Supported and recommended

## 🐛 Troubleshooting

### Common Issues

#### "Can't capture keystrokes"
**Solution**: Check accessibility permissions
- Mac: System Preferences → Security → Privacy → Accessibility
- Windows: Run as Administrator
- Linux: Add user to `input` group

#### "Canvas is slow with many nodes"
**Solution**: Adjust performance settings
```json
{
  "canvas": {
    "virtualization": true,
    "maxVisibleNodes": 50
  }
}
```

#### "Export code doesn't run"
**Solution**: Check dependencies
```bash
# For Playwright export
npm install playwright

# For Python export
pip install pyautogui pandas
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
# Fork and clone
git clone https://github.com/yourusername/process-capture-studio.git

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build
npm run build
```

## 📈 Roadmap

### Version 1.1 (Q2 2025)
- [ ] OCR for reading screen content
- [ ] AI-powered pattern detection
- [ ] Cloud sync (optional)
- [ ] Team collaboration features

### Version 1.2 (Q3 2025)
- [ ] API integrations
- [ ] Database query builder
- [ ] Email automation
- [ ] Advanced error recovery

### Version 2.0 (Q4 2025)
- [ ] Process marketplace
- [ ] Version control
- [ ] Compliance tracking
- [ ] Performance analytics

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/) - Desktop framework
- [iohook](https://github.com/wilix-team/iohook) - System-wide capture
- [Playwright](https://playwright.dev/) - Browser automation

## 📞 Support

- **Documentation**: [docs.processcapturestudio.com](https://docs.processcapturestudio.com)
- **Issues**: [GitHub Issues](https://github.com/yourusername/process-capture-studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/process-capture-studio/discussions)
- **Email**: support@processcapturestudio.com

## 🌟 Why Process Capture Studio?

> "We reduced our process documentation time from days to hours, and the exported automation code actually works!" - *Enterprise Customer*

> "Finally, a tool that captures not just what we do, but why we do it." - *Process Consultant*

> "The three-panel system is genius. Seeing the process build live changed how we think about automation." - *IT Director*

---

**Ready to revolutionize your process documentation?**

[⬇️ Download Now](https://github.com/yourusername/process-capture-studio/releases) | [📺 Watch Demo](https://youtube.com/demo) | [📖 Read Docs](https://docs.processcapturestudio.com)

---

*Built with ❤️ for process professionals who know there's a better way*

## GitHub Workflow Example

This section demonstrates the GitHub feature branch workflow:

### Creating a Feature Branch
```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Make your changes
# Edit files, add new features, fix bugs

# Stage and commit changes
git add .
git commit -m "Add your feature description"

# Push branch to GitHub
git push -u origin feature/your-feature-name
```

### Creating a Pull Request
1. Go to GitHub repository
2. Click "Compare & pull request" button
3. Add description of changes
4. Request reviewers if needed
5. Click "Create pull request"

### Merging to Main
After review and approval:
```bash
# Option 1: Merge via GitHub UI (recommended)
# Click "Merge pull request" on GitHub

# Option 2: Merge locally
git checkout main
git merge feature/your-feature-name
git push origin main

# Clean up feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

This example change was made on the `feature/improve-readme` branch to demonstrate the workflow!