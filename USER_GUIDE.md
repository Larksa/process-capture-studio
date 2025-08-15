# Process Capture Studio - Complete User Guide

## 📚 Table of Contents
1. [Overview](#overview)
2. [Starting the Application](#starting-the-application)
3. [Understanding the Two-Terminal System](#understanding-the-two-terminal-system)
4. [How Capture Works](#how-capture-works)
5. [Browser and Web Application Support](#browser-and-web-application-support)
6. [Cross-Application Paste Tracking](#cross-application-paste-tracking)
7. [What Gets Captured](#what-gets-captured)
8. [Reading the Terminal Output](#reading-the-terminal-output)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Process Capture Studio is a powerful workflow capture tool that records EVERYTHING you do across ALL applications with full context. It captures not just WHAT you do, but WHERE data comes from and WHERE it goes.

### Key Features:
- **Universal capture**: Works with any application
- **Data flow tracking**: Knows when you copy from Excel and paste to Salesforce
- **Web app aware**: Identifies Salesforce, WordPress, ActiveCampaign automatically
- **Complete context**: Captures file paths, cell addresses, page numbers, URLs
- **Zero configuration**: Just start and it works

---

## 🚀 Starting the Application

### Step 1: Start the Electron App (Green Terminal)
```bash
npm start
npm run start:classic
npm run start:modern
```
This launches the main UI interface.

### Step 2: Start the Python Service (Blue Terminal)
```bash
cd src/python
./start_capture.sh
```
This enables clipboard monitoring, Excel integration, and file tracking.

### What to Look For:

**Green Terminal (Electron) should show:**
- "Browser context will be enriched via worker process"
- "Python bridge connected to capture service"
- "🚀 Python bridge listening on port 9876"

**Blue Terminal (Python) should show:**
- "🔌 Connected to Electron on port 9876"
- "📋 Clipboard monitoring active"
- "📊 Connected to Excel" (if Excel is running)
- "✅ Service running. Press Ctrl+C to stop."

---

## 🖥️ Understanding the Two-Terminal System

### Why Two Terminals?

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   GREEN TERMINAL        │     │   BLUE TERMINAL         │
│   (Electron/Node.js)    │     │   (Python Service)      │
├─────────────────────────┤     ├─────────────────────────┤
│ • User Interface        │     │ • Clipboard Monitor     │
│ • Keyboard/Mouse        │ ←→  │ • Excel Integration     │
│ • Browser Context       │     │ • File Operations       │
│ • Main Process          │     │ • Office Automation     │
└─────────────────────────┘     └─────────────────────────┘
         ↓                                ↓
         └────────────┬───────────────────┘
                      ↓
              WebSocket (Port 9876)
                      ↓
            📦 Unified Event Buffer
                      ↓
              📄 Complete Export
```

### Data Flow:
1. **Both terminals** capture different types of events
2. **Python events** flow to Electron via WebSocket
3. **Everything merges** into one timeline
4. **Exports contain** all events from both sources

---

## 📹 How Capture Works

### Starting a Capture Session

1. **Click "Start Capture"** in the UI
2. **EVERYTHING is now being recorded:**
   - Every click
   - Every keystroke
   - Every copy/paste
   - Every file operation
   - Every application switch

### You DON'T Need To:
- ❌ Start with any specific action
- ❌ Configure anything
- ❌ Open browsers beforehand
- ❌ Prepare applications

### Just:
- ✅ Click "Start Capture"
- ✅ Do your normal work
- ✅ Click "Stop"
- ✅ Export the complete workflow

---

## 🌐 Browser and Web Application Support

### Supported Browsers (ALL work the same):
- ✅ Google Chrome
- ✅ Safari
- ✅ Mozilla Firefox
- ✅ Microsoft Edge
- ✅ Opera
- ✅ Brave
- ✅ Arc
- ✅ Vivaldi
- ✅ Tor Browser
- ✅ DuckDuckGo Browser
- ✅ Any other browser (via generic handler)

### Automatically Detected Web Applications:

**CRM Systems:**
- Salesforce
- HubSpot

**Marketing Platforms:**
- ActiveCampaign
- MailChimp

**Content Management:**
- WordPress
- Drupal

**Productivity Tools:**
- Google Docs/Sheets
- Notion
- Airtable

**Project Management:**
- Jira
- Trello
- Asana

### How Browser Detection Works:

```
You paste in Chrome/Safari/Firefox
         ↓
System reads window title: "New Contact | Salesforce"
         ↓
Detects "Salesforce" keyword
         ↓
Records as: "Paste to Salesforce" (not just "Chrome")
```

---

## 📋 Cross-Application Paste Tracking

### What Makes This Special:

The system tracks the COMPLETE data journey:

```
SOURCE                      DESTINATION
------                      -----------
Excel cell A1:B10     →     Word document page 5
Excel sheet "Data"    →     PowerPoint slide 7
Word paragraph 3      →     Salesforce contact form
Browser table         →     Excel spreadsheet
```

### Example: Excel to Salesforce

When you:
1. Copy from Excel cell A1
2. Paste into Salesforce contact form

The system captures:
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Microsoft Excel",
    "document": "customers.xlsx",
    "location": {
      "sheet": "Sheet1",
      "address": "$A$1",
      "path": "/Users/you/Documents/customers.xlsx"
    },
    "content": "john.doe@example.com"
  },
  "destination": {
    "application": "Google Chrome",
    "web_app": "Salesforce",
    "page_title": "New Contact | Salesforce",
    "type": "web_application"
  },
  "dataFlow": {
    "from": "customers.xlsx!Sheet1!$A$1",
    "to": "Salesforce: New Contact",
    "transformation": "data_to_form"
  }
}
```

---

## 📊 What Gets Captured

### For EVERY Application:
- **Application name** (Excel, Chrome, Word, etc.)
- **Window title**
- **Timestamp**
- **Action type** (click, type, copy, paste)

### For Office Applications:

**Excel:**
- Workbook name and full path
- Sheet name
- Cell address (e.g., $A$1:$B$10)
- Cell values and formulas
- Selection contents

**Word:**
- Document name and path
- Page number
- Paragraph number
- Cursor position

**PowerPoint:**
- Presentation name
- Slide number
- Selected shapes/text

### For Web Applications:
- Browser name
- Page title
- Domain
- Detected web app (Salesforce, WordPress, etc.)
- Form context (when available)

### For File Operations:
- File paths (source and destination)
- Operation type (create, move, delete, modify)
- File size and type
- Parent folders

---

## 👀 Reading the Terminal Output

### Green Terminal (Electron/Main App):

```
📋 Paste detected in Google Chrome - requesting destination context
Click detected in Microsoft Excel
Keystroke: Cmd+C in Excel
Browser worker returned success for ID=12345
📥 Python event: clipboard_copy
📥 Python event: cross_app_paste
```

### Blue Terminal (Python Service):

```
📊 Excel: Selected $A$1:$B$8 in Summary
📋 Clipboard captured: john.doe@example.com from Microsoft Excel
📋 Received request to capture paste destination in Google Chrome
📋 Cross-app paste: customers.xlsx!Sheet1!$A$1 → Salesforce: New Contact
📁 Monitoring: /Users/you/Downloads
📁 File created: report_2024.pdf
```

### Understanding the Icons:
- 📊 = Excel operation
- 📋 = Clipboard/paste operation
- 📁 = File operation
- 📥 = Event received from Python
- 🔌 = Connection status
- ✅ = Success
- ❌ = Error

---

## 🧪 Testing Guide

### Test 1: Basic Excel to Word

1. **Start capture** (both terminals running)
2. Open Excel, select cells with data
3. Copy (Cmd+C / Ctrl+C)
4. Open Word document
5. Paste (Cmd+V / Ctrl+V)
6. Stop capture and export

**Verify in export:**
- Source shows Excel file, sheet, cells
- Destination shows Word file, page, paragraph
- Data transformation: "table_to_text"

### Test 2: Excel to Salesforce

1. **Start capture**
2. Copy email from Excel
3. Open Salesforce in ANY browser
4. Navigate to contact form
5. Paste into email field
6. Stop and export

**Verify in export:**
- Source shows Excel details
- Destination shows "Salesforce" (not just "Chrome")
- Web app is identified correctly

### Test 3: Multi-Browser Test

1. **Start capture**
2. Copy text from Word
3. Paste in Chrome (Gmail)
4. Copy from Chrome
5. Paste in Safari (WordPress)
6. Copy from Safari
7. Paste in Firefox (ActiveCampaign)

**Verify in export:**
- Each browser is identified
- Each web app is detected
- Complete data flow chain is visible

---

## 🔧 Troubleshooting

### Python Service Issues

**Problem:** "Connection refused" or no Python events
```bash
# Check if Python service is running:
ps aux | grep capture_service

# If not, restart:
cd src/python
./start_capture.sh
```

**Problem:** "Excel not connected"
```bash
# Make sure Excel is open BEFORE starting Python service
# On macOS: Grant automation permissions in System Settings
```

### Missing Paste Context

**Problem:** Paste detected but no destination details
- Check both terminals are running
- Verify "Connected to Electron on port 9876" in Python terminal
- Ensure application has focus when pasting

### Browser Not Detected

**Problem:** Shows "Google Chrome" instead of "Salesforce"
- Check window title contains the web app name
- The page must be loaded (not loading)
- Some apps only show name on certain pages

### Permission Issues (macOS)

**Required permissions:**
- System Settings → Privacy & Security → Accessibility
- System Settings → Privacy & Security → Automation
- Add Terminal AND Process Capture Studio

---

## 💡 Pro Tips

### 1. Complete Workflow Capture
Start capture BEFORE beginning your workflow - everything will be recorded automatically.

### 2. Mark Important Steps
Press **Cmd+Shift+M** (Mac) or **Ctrl+Shift+M** (Windows) to mark important moments during capture.

### 3. Check Both Terminals
The Blue terminal often shows more detail about what's being captured, especially for Excel and clipboard operations.

### 4. Excel Best Practices
- Open Excel BEFORE starting the Python service
- Select cells before copying for best context
- The system captures actual cell values, not just addresses

### 5. Web App Detection
For best results with web apps:
- Let pages fully load before pasting
- Use the main pages (e.g., contact forms, dashboards)
- The system detects based on window title keywords

### 6. Export Formats
- **JSON**: Best for automation and detailed analysis
- **Playwright/Puppeteer**: For web automation
- **Raw Log**: For debugging and complete timeline

---

## 📝 Quick Reference Card

### Starting the App:
```bash
Terminal 1: npm start
Terminal 2: cd src/python && ./start_capture.sh
```

### Key Shortcuts:
- **Start/Stop Capture**: Click button in UI
- **Mark Important**: Cmd+Shift+M (Mac) / Ctrl+Shift+M (Windows)
- **Emergency Stop**: Ctrl+C in either terminal

### What's Captured:
✅ All clicks
✅ All keystrokes
✅ All copy/paste with context
✅ All file operations
✅ Excel cells with values
✅ Word/PowerPoint locations
✅ Browser web apps
✅ Application switches

### Terminal Colors:
- **Green**: Main Electron app
- **Blue**: Python service (clipboard, Excel, files)

### Port: 9876 (WebSocket between terminals)

---

## 🎓 Understanding the Magic

The power of Process Capture Studio is that it understands CONTEXT:

**Traditional tools** capture: "User clicked at coordinates 500,300"

**Process Capture Studio** captures: "User clicked cell B5 in customers.xlsx containing 'john@example.com', then pasted it into the Email field of Salesforce's New Contact form"

This context makes it possible to:
- Generate accurate automation code
- Understand business processes
- Track data lineage
- Ensure compliance
- Create training materials

---

*Remember: Once you click "Start Capture", everything is being recorded with full context until you click "Stop". The system works silently in the background, capturing your complete workflow across all applications.*
