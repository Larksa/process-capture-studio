# Universal Cross-Application Paste Tracking Test Guide

## Overview
This test validates the universal paste tracking system that captures data flow between ANY applications, including Office apps, browsers, and web applications like Salesforce, ActiveCampaign, and WordPress.

## Setup

1. **Start Process Capture Studio:**
   ```bash
   # Terminal 1 - Electron app
   npm start
   
   # Terminal 2 - Python service  
   cd src/python
   ./start_capture.sh
   ```

2. **Prepare Test Applications:**
   - Excel spreadsheet with sample data
   - Word document
   - PowerPoint presentation
   - Browser with web apps (Salesforce, ActiveCampaign, WordPress)

## Test Scenarios

### Test 1: Excel → Word
**Setup:** Open Excel with customer data, Word with report template

**Steps:**
1. Select cells in Excel (e.g., customer names and revenue)
2. Copy (Cmd+C / Ctrl+C)
3. Switch to Word document
4. Place cursor in report section
5. Paste (Cmd+V / Ctrl+V)

**Expected Output:**
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Microsoft Excel",
    "document": "customers.xlsx",
    "type": "spreadsheet",
    "location": {
      "sheet": "Sheet1",
      "address": "$A$1:$B$10",
      "type": "cell_range"
    }
  },
  "destination": {
    "application": "Microsoft Word",
    "document": "Q4_Report.docx",
    "type": "document",
    "location": {
      "page": 5,
      "paragraph": 12,
      "type": "text_position"
    }
  },
  "dataFlow": {
    "from": "customers.xlsx!Sheet1!$A$1:$B$10",
    "to": "Q4_Report.docx (Page 5, Para 12)",
    "transformation": "table_to_text"
  }
}
```

### Test 2: Excel → PowerPoint
**Setup:** Excel with charts/data, PowerPoint presentation

**Steps:**
1. Select data range in Excel
2. Copy (Cmd+C / Ctrl+C)
3. Switch to PowerPoint
4. Navigate to specific slide
5. Paste (Cmd+V / Ctrl+V)

**Expected Output:**
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Microsoft Excel",
    "document": "metrics.xlsx",
    "type": "spreadsheet",
    "location": {
      "sheet": "Dashboard",
      "address": "$A$1:$D$20"
    }
  },
  "destination": {
    "application": "Microsoft PowerPoint",
    "document": "Q4_Presentation.pptx",
    "type": "presentation",
    "location": {
      "slide": 7,
      "type": "slide"
    }
  },
  "dataFlow": {
    "transformation": "data_to_slide"
  }
}
```

### Test 3: Excel → Salesforce (Browser)
**Setup:** Excel with contact data, Salesforce contact form open

**Steps:**
1. Copy cell from Excel (e.g., email address)
2. Switch to Chrome/Safari with Salesforce
3. Click in email field
4. Paste (Cmd+V / Ctrl+V)

**Expected Output:**
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Microsoft Excel",
    "document": "leads.xlsx",
    "type": "spreadsheet",
    "location": {
      "sheet": "Contacts",
      "address": "$C$5"
    },
    "content": "john.doe@company.com"
  },
  "destination": {
    "application": "Google Chrome",
    "type": "web_application",
    "web_app": "Salesforce",
    "page_title": "New Contact | Salesforce",
    "domain": "salesforce.com",
    "location": {
      "page": "New Contact | Salesforce",
      "type": "web_form"
    }
  },
  "dataFlow": {
    "transformation": "data_to_form"
  }
}
```

### Test 4: Word → ActiveCampaign
**Setup:** Word with email content, ActiveCampaign campaign editor

**Steps:**
1. Select paragraph in Word
2. Copy (Cmd+C / Ctrl+C)
3. Switch to browser with ActiveCampaign
4. Click in email body editor
5. Paste (Cmd+V / Ctrl+V)

**Expected Output:**
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Microsoft Word",
    "document": "email_template.docx",
    "type": "document",
    "location": {
      "page": 2,
      "paragraph": 3
    }
  },
  "destination": {
    "application": "Safari",
    "type": "web_application",
    "web_app": "ActiveCampaign",
    "page_title": "Email Campaign Editor | ActiveCampaign",
    "location": {
      "type": "web_form"
    }
  },
  "dataFlow": {
    "transformation": "text_to_form"
  }
}
```

### Test 5: Browser → Excel (Web Scraping)
**Setup:** WordPress admin with data table, Excel spreadsheet

**Steps:**
1. Select data in WordPress admin table
2. Copy (Cmd+C / Ctrl+C)
3. Switch to Excel
4. Select cell
5. Paste (Cmd+V / Ctrl+V)

**Expected Output:**
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Google Chrome",
    "type": "web_application",
    "web_app": "WordPress",
    "page_title": "Posts ‹ My Site — WordPress",
    "domain": "wordpress.com"
  },
  "destination": {
    "application": "Microsoft Excel",
    "document": "content_audit.xlsx",
    "type": "spreadsheet",
    "location": {
      "sheet": "Posts",
      "address": "$A$10"
    }
  },
  "dataFlow": {
    "transformation": "web_to_data"
  }
}
```

### Test 6: Generic Application (Fallback)
**Setup:** Any unsupported application (e.g., Notes, TextEdit)

**Steps:**
1. Copy from any app
2. Paste to another app

**Expected Output:**
```json
{
  "type": "cross-app-paste",
  "source": {
    "application": "Notes",
    "type": "unknown",
    "document": "Meeting Notes"
  },
  "destination": {
    "application": "TextEdit",
    "type": "unknown",
    "document": "draft.txt",
    "location": {
      "type": "unknown",
      "timestamp": "2024-01-15T10:30:45.123Z"
    }
  },
  "dataFlow": {
    "transformation": "direct_paste"
  }
}
```

## Validation Checklist

- [ ] Excel → Word captures page and paragraph
- [ ] Excel → PowerPoint captures slide number
- [ ] Excel → Browser identifies web application
- [ ] Word → Browser preserves document location
- [ ] Browser → Excel identifies source web app
- [ ] Salesforce is correctly identified as web app
- [ ] ActiveCampaign is correctly identified
- [ ] WordPress is correctly identified
- [ ] Unknown apps use generic fallback
- [ ] Data transformations are correctly detected
- [ ] All events appear in unified JSON export
- [ ] Raw log contains all paste events

## Console Output to Watch

**Python Terminal:**
```
📋 Received request to capture paste destination in Microsoft Word
📋 Cross-app paste: customers.xlsx!Sheet1!$A$1:$B$10 → Q4_Report.docx (Page 5, Para 12)

📋 Received request to capture paste destination in Google Chrome
📋 Cross-app paste: leads.xlsx!Contacts!$C$5 → Salesforce: New Contact | Salesforce
```

**Electron Terminal:**
```
📋 Paste detected in Microsoft Word - requesting destination context
📋 Paste detected in Google Chrome - requesting destination context
```

## Export Verification

After testing, export the capture and verify:

1. **JSON Export** contains structured `cross-app-paste` events
2. **Raw Log** shows complete event flow
3. **Data Flow** section shows transformations:
   - `table_to_text`: Excel table → Word paragraph
   - `data_to_slide`: Excel data → PowerPoint slide
   - `data_to_form`: Excel → Web form
   - `text_to_form`: Word → Web form
   - `web_to_data`: Web → Excel
   - `direct_paste`: Same type or unknown

## Troubleshooting

- **No destination captured**: Check Python service is running
- **Web app not identified**: Check window title contains app name
- **Office app errors**: Grant automation permissions (macOS)
- **Missing location details**: Ensure apps have focus during paste