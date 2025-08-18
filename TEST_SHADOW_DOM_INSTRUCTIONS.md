# Testing Shadow DOM & Framework ID Enhancement

## Quick Test Instructions

### 1. Start the App
```bash
npm start
```

### 2. Connect Browser
Click "🌐 Connect Browser" button

### 3. Open Test Page
In the Chromium browser that opens, navigate to:
```
file:///Users/andrewlarkey/process-capture-studio-app/test-shadow-dom.html
```

### 4. Start Capture
Click "Start Capture" in Process Capture Studio

### 5. Test Elements

Click on these elements in order and observe the console output:

#### ❌ Bad Selectors (Should NOT use):
- **Ember Button** - Has `#ember650` (framework ID)
- **React Input** - Has `#react-select-1` (framework ID)
- **Angular Button** - Has `_ngcontent-abc-123` (framework ID)

#### ✅ Good Selectors (Should use):
- **Submit Button** - Has `data-testid="submit-button"` ✅
- **Email Field** - Has `data-automation-id="email-field"` ✅
- **Save Button** - Has stable ID `#save-button` ✅
- **Delete Button** - Has `aria-label="Delete item"` ✅

#### 🔮 Shadow DOM Components:
- **Custom Button** - Shadow DOM component
- **Vaadin Button** - Has `data-testid="vaadin-submit"`
- **Material Button** - Has `data-test="material-button"`

#### 🎭 Mixed Scenarios:
- **Mixed Button** - Has bad `#ember789` but good `data-testid="mixed-button"`
  - Should use: `[data-testid="mixed-button"]` ✅
  - Should NOT use: `#ember789` ❌

### 6. Export and Verify

1. Stop capture
2. Export to **JSON** format
3. Check that elements have:

```json
{
  "element": {
    "selectors": {
      // OLD fields still present
      "id": "#ember650",  // Present but marked as framework-generated
      "css": "#ember650 > div > button",
      
      // NEW fields should be populated
      "stableCSS": "button.create",  // No framework IDs!
      "cssWithoutFrameworkIds": "div > button.create",
      "dataAttributes": {
        "testid": "submit-button",
        "test": "submit"
      },
      "alternativeSelectors": [
        "[data-testid='submit-button']",
        "[aria-label='Submit']",
        "button.create"
      ],
      "isInShadowDOM": false,
      "enterpriseFramework": null
    }
  }
}
```

### 7. Export to Playwright

Export to **Playwright** format and verify:

1. **Data attributes used first**:
   ```javascript
   await page.click('[data-testid="submit-button"]');  // ✅ Good
   ```
   NOT:
   ```javascript
   await page.click('#ember650');  // ❌ Bad - framework ID
   ```

2. **Shadow DOM comments added**:
   ```javascript
   // Shadow DOM component: custom-button
   // Playwright auto-pierces open shadow roots
   await page.click('custom-button');
   ```

3. **Enterprise framework detected**:
   ```javascript
   // salesforce-lightning component
   await page.click('[data-testid="lightning-submit"]');
   ```

## What Success Looks Like

### Console Output
When clicking elements, you should see:
```
[BrowserService] Executing page.evaluate to find element with Shadow DOM support...
[Export] Using data attribute selector: [data-testid="submit-button"]
[Export] Skipping framework-generated ID: #ember650
[Export] Using stable CSS selector: button.create
```

### JSON Export
- `stableCSS` field populated without framework IDs
- `alternativeSelectors` array has multiple fallback options
- `dataAttributes` object contains all data-* attributes
- `isInShadowDOM` correctly identifies Shadow DOM elements
- `enterpriseFramework` identifies Salesforce/Vaadin/etc.

### Playwright Export
- Uses data attributes when available
- Adds helpful comments for Shadow DOM
- Doesn't use framework-generated IDs
- Includes alternative selectors as comments

## Common Issues

### Issue: Still seeing #ember IDs in exports
**Fix**: Make sure browser-context-service.js is using the new enhanced logic

### Issue: Shadow DOM not detected
**Fix**: The test page simulates Shadow DOM - real components will be detected properly

### Issue: Alternative selectors empty
**Fix**: Check that generateAlternativeSelectors is being called in browser-context-service.js

## ActiveCampaign Specific Test

When testing with real ActiveCampaign:
1. The `#ember*` IDs should be filtered out
2. Stable classes like `.contacts_index_subheader_add-contact` should be used
3. Custom elements like `<camp-button>` should be preserved
4. Text content should be captured for buttons

Expected selector priority:
1. `[data-test="add-contact"]` if present
2. `camp-button.contacts_index_subheader_add-contact`
3. `camp-button span:has-text("Add a contact")`
4. NOT `#ember650` ❌