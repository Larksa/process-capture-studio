# Debugging Browser Capture Issues

## Problem: DOM Elements Not Being Captured

Your JSON shows the capture is missing critical browser context:
```json
"element": null,  // Should have selectors!
"browserContext": {
  "url": null,  // Should show the actual URL!
  "pageTitle": "Sue Larkey - Contacts"
}
```

## Quick Diagnostic Steps:

### 1. Check Console Output
When you click in the Chromium browser while capturing, look for these messages in the terminal:

**Good signs:**
```
[BrowserWorker] ========================================
[BrowserWorker] GET ELEMENT AT POINT
[BrowserWorker] Element found: ✅
[BrowserWorker] URL: https://yoursite.com
[BrowserWorker] Selector: #email-field
```

**Bad signs:**
```
[BrowserWorker] ❌ No active page available
[BrowserWorker] No element found at coordinates
[BrowserService] No active page available
```

### 2. Test Browser Connection
Click the "🧪 Test Browser" button (if visible) or try these steps:
1. Make sure Chromium window is in focus
2. Navigate to a simple page like google.com
3. Click on the search box while capture is running
4. Check if the JSON shows element selectors

### 3. Common Fixes:

#### Fix A: Restart Browser Worker
```bash
# Stop the app (Ctrl+C)
# Start fresh
npm start
# Click "Connect Browser" again
```

#### Fix B: Check Active Page
The browser might have lost track of which tab is active:
1. Click on the Chromium window to focus it
2. Click on the tab you want to capture from
3. Wait 2 seconds (for active page detection)
4. Try clicking an element

#### Fix C: Navigate After Connection
1. Connect Browser first
2. THEN navigate to your target site
3. This ensures the page tracking is set up properly

## How to Verify It's Working:

### In the JSON, search for these keywords:
```bash
# Good - these should be present:
"selector"
"xpath"
"css"
"id"
"className"

# Bad - these indicate problems:
"element": null
"url": null
```

### Good JSON Example:
```json
{
  "type": "click",
  "element": {
    "selectors": {
      "css": "#contact-email",
      "xpath": "//input[@id='contact-email']",
      "id": "contact-email",
      "className": "form-control",
      "text": ""
    },
    "tag": "input",
    "type": "email",
    "name": "email"
  },
  "pageContext": {
    "url": "https://yoursite.com/contacts",
    "title": "Contact Form",
    "domain": "yoursite.com"
  }
}
```

## Root Cause Possibilities:

1. **Page Focus Issue**: Chromium lost track of which page is active
2. **Timing Issue**: Clicking too fast after navigation
3. **Coordinate Transformation**: Click coordinates not mapping to browser viewport correctly
4. **Worker Communication**: Browser worker not receiving/sending element data

## Ultimate Test:

1. Open Chromium (via Connect Browser)
2. Navigate to: https://www.google.com
3. Start capture
4. Click on the Google search box
5. Type "test"
6. Stop capture and export to JSON

If this simple test doesn't show selectors, the browser worker needs to be restarted.

## Console Commands to Debug:

When the app is running, these messages indicate proper function:
```
[BrowserService] Current page URL: https://...
[BrowserService] Element found: <input>
[BrowserWorker] Element details: { selector: '#...', ... }
✅ Enhanced browser context captured
```

Missing these messages means the browser context isn't being enriched.