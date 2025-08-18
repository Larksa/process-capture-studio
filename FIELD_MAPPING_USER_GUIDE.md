# Complete User Guide: CSV/Excel to Web Form Field Mapping

## 📋 Prerequisites

1. **Have your data ready**:
   - Excel file open with your data OR
   - CSV file open in Excel, Numbers, or a web viewer
   - First row should have column headers (First Name, Last Name, Email, etc.)

2. **Have your target web form open**:
   - Login to the website if needed
   - Navigate to the form you want to fill
   - Make sure you can see both the data source and form on screen

## 🚀 Step-by-Step Process

### Step 1: Start Process Capture Studio

```bash
# In terminal, navigate to the app folder
cd ~/process-capture-studio-app

# Start the application
npm start
```

The Process Capture Studio window will open.

### Step 2: Start Python Service (for Excel capture)

**Open a NEW terminal window** and run:

```bash
cd ~/process-capture-studio-app/src/python
./start_capture.sh
```

You should see:
```
🚀 Process Capture Service Started
📊 Excel monitor initialized
📋 Clipboard monitor active
```

Leave this terminal running.

### Step 3: Begin Capture Mode (REQUIRED FIRST!)

In Process Capture Studio:

1. Click the **"Start Capture"** button (turns red when active)
2. You should see "Capture Active" status
3. The activity panel will start showing events

⚠️ **IMPORTANT**: Capture MUST be running before you can start field mapping!

### Step 4: Start Field Mapping Mode

1. **Verify capture is active** (red recording dot visible)
2. Click the **"🔗 Map Fields"** button
3. A semi-transparent overlay appears with instructions
4. You'll see: "Click on a CSV/Excel column or cell to start mapping..."

**If you see "Please start capture first":**
- Click "Start Capture" first
- Wait for it to turn red
- Then click "Map Fields"

### Step 5: (Optional but Recommended) Capture Browser Session

**For authenticated/logged-in forms**, capture your session to avoid re-login during automation:

1. **Make sure you're logged into the website**
2. Click the **"🔐 Capture Session"** button in the mapping overlay
3. Wait for "⏳ Capturing..." to change to **"✅ Session Captured"**
4. You'll see: "🔐 Browser session captured successfully! Login state will be preserved."

**What this does:**
- Captures all cookies, localStorage, and sessionStorage
- Allows automation to skip login screens
- Preserves form state and CSRF tokens
- Maintains your authenticated session

⚠️ **Security Note:** The exported file will contain auth tokens. Treat it like a password file!

### Step 6: Create Your First Mapping

#### 6A. Select Source Data (Excel/CSV)

1. **Click on your Excel/CSV window** to focus it
2. **Click on a cell** containing sample data (e.g., click on "John" in the First Name column)
3. **Copy the cell** (Cmd+C on Mac, Ctrl+C on Windows) - this captures the actual value
4. The overlay will show: `📊 Source: Excel A2 - Value: "John"`
5. The prompt changes to: "Now navigate to and click on the form field"

💡 **Why Copy?** The copy action tells the system:
- Which cell you're mapping (location)
- What type of data it contains (the value)
- That this is your source field for mapping

#### 6B. Navigate to Form Field (with navigation tracking!)

Now Process Capture Studio is recording EVERY action you take:

1. **Click on your browser window** to focus it
2. **Navigate to the field** - examples:
   - Click a tab labeled "Personal Information"
   - Click a dropdown to expand a section
   - Scroll down to find the field
   - Click "Next" to go to page 2
   - Open an accordion section
3. **Click IN the target form field** (e.g., the First Name input box)
4. **Paste the value** (Cmd+V on Mac, Ctrl+V on Windows) - this confirms the destination
5. You'll see: `✅ Mapped: Excel A2 → First Name field`

The mapping now includes:
- Source location (Excel A2)
- Source value ("John")
- All navigation steps to reach the field
- Destination field selector (#firstName)

### Step 7: Create Additional Mappings

Repeat Step 6 for each field:

**Example Sequence:**
```
1. Click Excel B2 → Copy (Cmd+C) → Click browser → Click Last Name field → Paste (Cmd+V)
   ✅ Mapped: Excel B2 → Last Name

2. Click Excel C2 → Copy → Click browser → Click "Contact Info" tab → Click Email field → Paste
   ✅ Mapped: Excel C2 → Email (1⚡)  [⚡ = navigation step recorded]

3. Click Excel D2 → Copy → Click browser → Still on Contact tab → Click Phone field → Paste
   ✅ Mapped: Excel D2 → Phone

4. Click Excel E2 → Copy → Click browser → Click "Next" → Wait → Click SSN field → Paste
   ✅ Mapped: Excel E2 → SSN (2⚡)  [2 navigation steps]
```

### Step 8: Complete Mapping

When you've mapped all fields:

1. Click **"Done"** button in the overlay
2. You'll see: "Saved X field mappings"
3. The overlay closes

### Step 9: Stop Capture

Click **"Stop Capture"** button (turns gray)

### Step 10: Export Your Automation Template

1. Click **"Export"** button
2. Choose format: **"Field Mapping"**
3. Click **"Generate"**
4. Click **"Save to File"**
5. Save as: `form-mapping-template.json`

## 📊 What Your Export Contains

```json
{
  "workflow_type": "field_mapping_with_navigation",
  "sessionState": {
    "cookies": [
      {
        "name": "session_id",
        "value": "xyz789...",
        "domain": ".example.com"
      }
    ],
    "origins": [
      {
        "origin": "https://example.com",
        "localStorage": {
          "user_token": "...",
          "preferences": "..."
        }
      }
    ]
  },
  "destination": {
    "type": "web_form",
    "url": "https://example.com/application",
    "authentication_required": true
  },
  "field_mappings": [
    {
      "source_column": "First_Name",
      "destination_selector": "#firstName",
      "navigation_required": false,
      "navigation_steps": []
    },
    {
      "source_column": "Email",
      "destination_selector": "#email",
      "navigation_required": true,
      "navigation_steps": [
        {
          "action": "tab_click",
          "element": {
            "selector": "#contact-tab",
            "text": "Contact Info"
          }
        }
      ]
    },
    {
      "source_column": "SSN",
      "destination_selector": "#ssn",
      "navigation_required": true,
      "navigation_steps": [
        {
          "action": "navigation_click",
          "element": {
            "selector": "#next-btn",
            "text": "Next"
          }
        },
        {
          "action": "expand_section",
          "element": {
            "text": "Personal Details"
          }
        }
      ]
    }
  ],
  "loop_instructions": {
    "type": "iterate_rows",
    "start_row": 2,
    "note": "For each row in source data, navigate to each field and fill"
  }
}
```

## 🎯 Tips for Success

### DO's:
- ✅ **Click directly IN form fields** (not just near them)
- ✅ **Perform navigation naturally** - the system captures everything
- ✅ **Use sample data** in row 2 for testing (row 1 = headers)
- ✅ **Map fields in any order** - the system remembers navigation for each
- ✅ **Test with "Test Mapping"** button before saving

### DON'Ts:
- ❌ **Don't click randomly** between source and destination
- ❌ **Don't use keyboard shortcuts** to switch windows (click instead)
- ❌ **Don't refresh the page** during mapping
- ❌ **Don't close Excel/CSV** during the process

## 🔧 Troubleshooting

**"Please start capture first" / Overlay not appearing:**
- You MUST click "Start Capture" BEFORE "Map Fields"
- Look for the red recording dot
- If you see this error, click "Start Capture" first, then try "Map Fields" again

**Excel value not captured:**
- Remember to COPY (Cmd+C/Ctrl+C) the cell after clicking it
- The copy action captures the actual cell value
- Without copying, only the cell location is recorded

**Source not detected from Excel:**
- Make sure Python service is running (`./start_capture.sh`)
- On Mac: Grant Terminal automation permissions for Excel
- Try copying the cell (Cmd+C) after selecting it

**Navigation not recorded:**
- Make sure you're clicking elements, not using keyboard shortcuts
- Wait for pages to load before clicking fields
- Each click between source and destination is recorded

**Can't see both windows:**
- Arrange Excel and browser side-by-side
- Or use Alt+Tab (Windows) / Cmd+Tab (Mac) to switch
- Multiple monitors work great for this!

## 🚦 Visual Indicators

- **Red recording dot**: Capture is active
- **Blue overlay**: Mapping mode active
- **Green checkmark**: Mapping created successfully
- **Lightning bolt (⚡)**: Navigation steps recorded
- **Number badge**: Count of navigation steps
- **🔐 Lock icon**: Session capture available/captured
- **✅ Check**: Session successfully captured

## 🔐 Session Capture Use Cases

### When to Capture Session:

**MUST CAPTURE for:**
- Forms behind login screens
- Applications requiring authentication
- Multi-step forms that timeout
- Forms with CSRF protection
- Banking/financial applications
- Healthcare portals
- Government websites

**OPTIONAL for:**
- Public forms
- Contact forms
- Survey forms without login
- Newsletter signups

### How Session Capture Works:

1. **Before Mapping**: Login to your application normally
2. **During Mapping**: Click "🔐 Capture Session" to save auth state
3. **In Export**: Session data included automatically
4. **During Replay**: Automation restores session, skips login

### Security Best Practices:

- 🔒 **Treat exports as passwords** - Contains auth tokens
- 🔒 **Never commit to Git** - Add `*.json` with session data to `.gitignore`
- 🔒 **Set expiration** - Regenerate templates when sessions expire
- 🔒 **Encrypt sensitive exports** - Use encryption for storage
- 🔒 **Delete after use** - Remove templates after automation completes

## 💡 Advanced Scenarios

### Multi-Page Forms:
1. Map fields on page 1
2. Click "Next" to go to page 2 (recorded as navigation)
3. Map fields on page 2
4. Template will replay the exact navigation

### Conditional Fields:
1. Create separate templates for different conditions
2. Name them descriptively: `form-mapping-individual.json`, `form-mapping-business.json`

### Different Data Formats:
- **Excel**: Click directly on cells
- **CSV in browser**: Click on table cells
- **Google Sheets**: Works the same as Excel

## 🎉 Using Your Template

Your template can now be used by automation tools to:
1. Read each row from your CSV/Excel
2. Navigate to each field using recorded steps
3. Fill in the values
4. Submit and repeat for next row

The template is **reusable** - same template works with different data files as long as column structure matches!

## 🔄 The Power of Reusability

### One Template, Many Uses:

**Create Once:**
- Map your mortgage application form fields (20 fields across 5 pages)
- Save as `mortgage-application-template.json`

**Use Forever:**
- Monday: Process 50 applications from `applications-week1.xlsx`
- Tuesday: Process 75 applications from `applications-week2.xlsx`
- Next Month: Process 500 applications from `bulk-applications.csv`

The template doesn't care about the VALUES - it just knows:
- Column A goes to First Name field (via Personal Info tab)
- Column B goes to Income field (via Financial tab → Annual Income section)
- Column C goes to SSN field (via Next button → Next button → Expand Details)

### Template Sharing:
- Share templates with your team
- Each person uses their own data file
- Same consistent process every time

## 📝 Notes

- Navigation steps are captured automatically - you don't need to do anything special
- The system is smart enough to distinguish between navigation actions and destination fields
- Complex forms with 50+ fields across multiple pages? No problem!
- The export format is JSON, making it compatible with most automation tools

## 🚨 Important Limitations

1. **Dynamic Forms**: If form structure changes based on answers, you'll need separate templates
2. **CAPTCHA**: Cannot automate CAPTCHA - requires human intervention
3. **File Uploads**: Click is captured but file selection needs manual handling
4. **2FA/MFA**: Two-factor authentication requires human intervention

## 📧 Support

For issues or questions about field mapping:
1. Check the main Process Capture Studio documentation
2. Review captured events in the Activity panel
3. Test with a simple form first before complex multi-page forms

---

*Last Updated: December 2024*
*Version: 1.1 - Navigation-Aware Field Mapping with Session Capture*

## 📝 Changelog

### Version 1.1
- Added **🔐 Session Capture** button for authenticated forms
- Session state now included in exports automatically
- Enhanced security documentation for handling auth tokens

### Version 1.0
- Initial release with navigation-aware field mapping
- Support for multi-page and complex forms
- CSV/Excel to web form automation templates