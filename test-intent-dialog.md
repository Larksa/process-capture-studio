# Test Plan: Intent-First Mark Before Pattern

## Test Scenario 1: Basic Flow
1. Start the app with `npm run dev`
2. Click "Start Capture" to begin general recording
3. Press `Cmd+Shift+M` (Mac) or `Ctrl+Shift+M` (Windows)
4. **Expected**: Intent dialog appears IMMEDIATELY asking "What are you about to do?"
5. Type: "Creating ActiveCampaign automation"
6. Click "Start Capture"
7. **Expected**: 
   - Dialog closes
   - Notification shows "Recording: Creating ActiveCampaign automation (30 seconds)"
   - Visual indicator shows capture is active
8. Perform your actions (click around, type, etc.)
9. After 30 seconds:
   - **Expected**: Completion dialog shows with your actions captured
   - Description is pre-filled with "Creating ActiveCampaign automation"
   - You can add context about WHY

## Test Scenario 2: Cancel Flow
1. Press `Cmd+Shift+M`
2. Dialog appears
3. Press `Escape` or click "Cancel"
4. **Expected**: Dialog closes, no capture starts

## Test Scenario 3: Empty Intent
1. Press `Cmd+Shift+M`
2. Dialog appears
3. Leave intent field empty and click "Start Capture"
4. **Expected**: Field highlights in red, focus returns to input

## Test Scenario 4: Export Verification
1. Complete a Mark Before capture with intent
2. Export as Playwright
3. **Expected**: Generated code should contain:
   - Comment with your intent description
   - Actual automation steps (not empty)
   - Proper selectors if browser context was captured

## Known Issues to Fix:
- [ ] Browser context capture needs to be re-enabled in worker process
- [ ] Some clicks might not have selectors yet
- [ ] Need to add the completion options (Done/Extend/Review)

## Success Criteria:
✅ Intent dialog appears IMMEDIATELY on shortcut
✅ User describes intent BEFORE action
✅ 30-second capture starts after intent is declared
✅ Completion dialog shows captured events
✅ Export generates working code