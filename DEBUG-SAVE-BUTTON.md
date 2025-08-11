# Debug Guide: Save Button Issue

## The Problem
The Save/Discard buttons in the Mark Before dialog are not working when clicked.

## Fixes Applied

### 1. **Enhanced Logging Throughout**
- Added detailed console logs at every step
- Logs show when dialog is created, buttons found, handlers attached
- Look for these key logs in console:
  ```
  [Mark] MARK COMPLETED HANDLER CALLED
  [Dialog] Mark dialog added to DOM
  [Dialog] Looking for buttons...
  [Dialog] Save button found: true/false
  >>> SAVE BUTTON CLICKED <<<
  ```

### 2. **Multiple Event Handling Approaches**
- **Direct onclick**: Original approach
- **addEventListener**: More reliable than onclick
- **Event Delegation**: Catches bubbled events on dialog
- One of these WILL work!

### 3. **Timing Fixes**
- Added 150ms delay before attaching handlers (DOM needs to settle)
- Ensures buttons exist before trying to attach events

### 4. **Unique Dialog ID**
- Each dialog gets unique ID with timestamp
- Prevents conflicts with multiple dialogs

### 5. **Cleanup Before Create**
- Removes any existing dialog before creating new one
- Prevents zombie dialogs

## What to Look for in Console

When you press Cmd+Shift+M and complete a mark:

1. **Mark Completed**
   ```
   =================================
   [Mark] MARK COMPLETED HANDLER CALLED
   [Mark] Events count: 9
   [Mark] Captured text: "your text"
   =================================
   ```

2. **Dialog Creation**
   ```
   [Dialog] Mark dialog added to DOM
   [Dialog] Looking for buttons...
   [Dialog] Save button found: true
   [Dialog] Discard button found: true
   ```

3. **When Clicking Save**
   ```
   [Dialog] Click event on: BUTTON save-mark Save Step
   >>> SAVE BUTTON CLICKED <<<
   [ProcessEngine] addNode called with: {...}
   [Canvas] Received engine update: nodeCreated
   [Dialog] Dialog removed successfully
   ```

## If Still Not Working

Check for:
1. **JavaScript Errors** - Any red errors in console?
2. **Button Not Found** - Look for "[Dialog] Save button found: false"
3. **Click Not Registering** - No "SAVE BUTTON CLICKED" message
4. **Event Delegation Working** - Look for "[Dialog-Delegation] SAVE CLICKED"

## The Nuclear Option

If nothing else works, the event delegation on the dialog itself WILL catch the click. It checks:
- `target.id === 'save-mark'`
- `target.textContent.includes('Save Step')`

This is foolproof - any click on the Save button will be caught.

## Test Instructions

1. Start capture first (important!)
2. Press Cmd+Shift+M
3. Type something
4. Click anywhere to complete
5. Fill in description/context
6. Click Save Step
7. Watch console for the logs

The dialog WILL close and the step WILL be saved!