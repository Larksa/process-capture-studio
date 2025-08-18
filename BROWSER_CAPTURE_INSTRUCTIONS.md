# Browser Context Capture - How to Use

## Overview
Process Capture Studio automatically captures browser context (DOM elements, URLs, selectors) when you interact with web pages. This uses a built-in Chromium browser managed by Playwright.

## How It Works

### Automatic Browser Launch
When you click "Connect Browser" in the app:
1. A new Chromium browser window opens automatically
2. This is a clean browser instance (no saved logins or cookies)
3. The browser is fully controlled by the app for capture

### What Gets Captured
When you click on web pages while capture is running:
- **DOM Selectors**: CSS selectors, IDs, XPath
- **Element Details**: Text content, attributes, type
- **Page Context**: URL, title, domain
- **Visual Position**: Coordinates and dimensions

## Step-by-Step Usage

### 1. Start the Application
```bash
npm start
```

### 2. Start General Capture
Click the **"Start Capture"** button to begin system-wide recording

### 3. Connect Browser (Optional but Recommended)
Click **"🌐 Connect Browser"** button:
- A Chromium browser window will open
- Status will show "Browser: Connected"
- You'll see a notification: "Connected to Chromium (temporary browser)"

### 4. Navigate and Interact
- Use the Chromium browser to navigate to your target website
- Log in if needed (the session can be captured)
- Perform your workflow - all clicks will capture DOM elements

### 5. Capture Session (For Authenticated Replay)
If you're logged into a website and want to replay with authentication:
1. Click **"🍪 Capture Session"** button
2. This saves cookies and localStorage
3. Replays will bypass login screens

### 6. Export with Selectors
When you export to Playwright/Puppeteer/Selenium:
- Code uses DOM selectors instead of coordinates
- Example: `await page.click('#submit-button')` instead of `pyautogui.click(x=450, y=320)`

## Important Notes

### Browser Type
- The app uses its own Chromium browser (not your regular Chrome)
- This ensures consistent capture across all systems
- Your regular Chrome remains unaffected

### Session Security
- Session files contain authentication tokens
- Treat them like passwords
- Never commit session files to version control

### Multi-Monitor Support
- Browser capture works across multiple monitors
- Coordinates are absolute but selectors are preferred
- For best results, keep browser on primary monitor

## Field Mapping Mode

For CSV/Excel to web form automation:
1. Click **"🔗 Map Fields"** button
2. Copy data from Excel/CSV
3. Navigate to web form
4. Paste into form fields
5. The app tracks the mapping automatically

## Troubleshooting

### Browser Won't Connect
- Just click "Connect Browser" again
- The app will launch a fresh Chromium instance

### Elements Not Capturing
- Make sure capture is running (green indicator)
- Ensure you're clicking in the Chromium window (not your regular browser)
- Check the console for element capture logs

### Session Not Working
- Capture session after logging in
- Some sites require re-capture after time passes
- Check if cookies have expired

## Benefits Over Coordinate-Based Capture

| Feature | With Browser Context | Without Browser Context |
|---------|---------------------|------------------------|
| Reliability | ✅ High - uses selectors | ⚠️ Low - uses coordinates |
| Cross-resolution | ✅ Works on any screen | ❌ Breaks on different screens |
| Maintenance | ✅ Self-healing | ❌ Needs re-recording |
| Speed | ✅ Fast - no visual search | ⚠️ Slower - pixel matching |
| Export Quality | ✅ Professional code | ⚠️ Brittle automation |

## Export Examples

### With Browser Context (Playwright)
```javascript
// Professional, maintainable code
await page.click('#login-button');
await page.fill('input[name="username"]', 'user@example.com');
await page.click('button:has-text("Submit Order")');
```

### Without Browser Context (PyAutoGUI)
```python
# Brittle, coordinate-based
pyautogui.click(x=450, y=320)  # Hope this is still the login button!
pyautogui.typewrite('user@example.com')
pyautogui.click(x=600, y=480)  # Hope the submit button hasn't moved!
```

## 🚀 IMPORTANT: You're NOT Locked Into Chromium!

### Chromium is ONLY for Capture - Run Anywhere!

**Key Point**: When you capture in Chromium and export, the automation works in **ALL browsers**:
- ✅ Chrome (your regular browser)
- ✅ Microsoft Edge
- ✅ Firefox
- ✅ Safari
- ✅ Any Chromium-based browser (Brave, Opera, etc.)

### Why This Works:

The app captures **DOM selectors** (like `#email-field` or `.submit-button`), not browser-specific features. These selectors are universal HTML/CSS that work identically in every browser.

### Real Example:
```javascript
// Captured in Chromium:
await page.fill('input#email', 'user@example.com');

// Same code works in Chrome, Edge, Firefox, Safari!
// Just change the browser launch command
```

### Deployment Flexibility:

1. **Development**: Capture in Chromium (controlled environment)
2. **Testing**: Export and test in any browser
3. **Production**: Users run in their company's standard browser
4. **Cloud**: Deploy to Selenium Grid, BrowserStack, etc.

### Changing Browsers in Exported Code:

**Playwright** - Change one line:
```javascript
// Original (Chromium):
const browser = await chromium.launch();

// For Firefox:
const browser = await firefox.launch();

// For Safari:
const browser = await webkit.launch();

// For user's Chrome:
const browser = await chromium.launch({ channel: 'chrome' });

// For Edge:
const browser = await chromium.launch({ channel: 'msedge' });
```

**Selenium** - Change browser name:
```javascript
// Original:
let driver = await new Builder().forBrowser('chrome').build();

// For Edge:
let driver = await new Builder().forBrowser('edge').build();

// For Firefox:
let driver = await new Builder().forBrowser('firefox').build();
```

### Session Portability:

Captured sessions (cookies/logins) can be:
- Exported as JSON files
- Imported into any Chromium-based browser
- Shared across team members
- Used in CI/CD pipelines

### The Bottom Line:

- **Chromium = Recording Studio** (capture phase only)
- **Exports = Universal Code** (runs anywhere)
- **No Lock-in** (use any browser in production)

## Summary

1. **Always use "Connect Browser"** for web automation capture
2. **Capture session** for authenticated workflows
3. **Export to Playwright/Puppeteer** for robust automation
4. **Use Field Mapping** for data entry automation
5. **Remember: Capture once in Chromium, run anywhere!**

The browser context capture transforms Process Capture Studio from a simple recorder to a professional RPA tool that generates maintainable, production-ready automation code that works in ANY browser.