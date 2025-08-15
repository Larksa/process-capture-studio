# Test Excel Cross-Document Copy/Paste Capture

## Test Setup

1. Open two Excel documents:
   - Source: `testing-auto.xlsx` 
   - Destination: Any other Excel file (e.g., `summary.xlsx`)

2. Start Process Capture Studio:
   ```bash
   # Terminal 1 - Electron app
   npm start
   
   # Terminal 2 - Python service  
   cd src/python
   ./start_capture.sh
   ```

3. Start recording in Process Capture Studio

## Test Steps

1. **Copy from Source Excel:**
   - Click on cell(s) in `testing-auto.xlsx`
   - Press Cmd+C (Mac) or Ctrl+C (Windows)
   - Watch Python terminal for: `📊 Excel: Selected [address] in [sheet]`
   - Watch for: `📋 Clipboard captured: [content] from Microsoft Excel`

2. **Paste to Destination Excel:**
   - Switch to the other Excel document
   - Click on destination cell
   - Press Cmd+V (Mac) or Ctrl+V (Windows)
   - Watch for: `📋 Paste detected in Excel - requesting destination context`
   - Watch Python terminal for: `📋 Received request to capture paste destination`
   - Watch for: `📊 Excel paste: [source_address] ([source_workbook]) → [dest_address] ([dest_workbook])`

3. **Stop Recording and Export**

## Expected Results

The exported data should show:

1. **Clipboard Event** with source Excel context:
   ```json
   {
     "type": "clipboard",
     "source": {
       "application": "Microsoft Excel",
       "excel_selection": {
         "workbook": "testing-auto.xlsx",
         "sheet": "Sheet1",
         "address": "$A$1:$B$2"
       }
     },
     "content": "[copied data]"
   }
   ```

2. **Excel Paste Event** with full data flow:
   ```json
   {
     "type": "excel-paste",
     "source": {
       "workbook": "testing-auto.xlsx",
       "sheet": "Sheet1",
       "address": "$A$1:$B$2",
       "content": "[copied data]"
     },
     "destination": {
       "workbook": "summary.xlsx",
       "sheet": "Summary",
       "address": "$C$5:$D$6"
     },
     "dataFlow": {
       "from": "testing-auto.xlsx!Sheet1!$A$1:$B$2",
       "to": "summary.xlsx!Summary!$C$5:$D$6"
     }
   }
   ```

## Troubleshooting

- **No paste context captured:** Check that Python service is running and connected
- **Missing Excel info:** Ensure Excel has automation permissions (macOS: System Settings > Privacy > Automation)
- **WebSocket errors:** Verify port 9876 is not in use