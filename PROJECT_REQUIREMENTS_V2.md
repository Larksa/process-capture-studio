# Process Capture Studio - Living Requirements V2
# NEXT GENERATION: Mark Before + Browser Session Persistence + AI Interpretation

## 🚦 Current Status
**Last Updated**: 2025-08-11 7:30 AM  
**Phase**: Phase 5 - Next Generation Features Planning
**Current Focus**: Mark Before Pattern Implementation
**Next Action**: Implement Mark Before with smart boundaries

## 📊 Progress Overview
- Total Core Features: 85% Complete
- Save/Clear System: ✅ Fixed
- Console Logging: ✅ Implemented  
- Mark Before Pattern: 🚧 Starting
- Browser Integration: 📋 Planned
- AI Interpretation: 📋 Planned

## 🎯 Original Vision + Evolution
[Preserved from initial conversation - NEVER delete, only annotate]

"I want to be able to sit down with my work colleagues and/or a process expert and have a chat on one side that guides through the logic and captures every single important movement in a process. The logic behind it, where it leads, why they got there, how did they get there."

**Evolution [2025-08-11]**: 
- Mark BEFORE pattern discovered - cleaner data capture
- Session persistence pattern from Python recorder - login once, use everywhere
- AI interpretation layer - understand WHAT user did, not just clicks

---

## 🚀 NEXT GENERATION FEATURES

### 1️⃣ Mark Before Pattern (Revolutionary Change)
**Problem Solved**: Current "mark after" creates ambiguity about which keystrokes belong to the step

**New Workflow**:
```
User: Press Ctrl+Shift+M (Mark Before)
System: "Ready to capture next action..." 
User: Performs action (click folder, fill form, etc.)
System: Detects completion → AI interprets → Quick confirm
```

**Smart Completion Detection**:
- Form submit → End capture
- Enter after typing → End capture  
- Navigation occurs → End capture
- File selected → End capture
- User marks again → End capture

**Benefits**:
- Groups keystrokes into meaningful units (not k-e-y-s-t-r-o-k-e)
- Clear boundaries for each step
- Cleaner data with clear intent
- Optional "why" prompt BEFORE action

### 2️⃣ Browser Session Persistence (From Python Recorder)
**Problem Solved**: Users have to login repeatedly during recording

**Implementation** (Adapted from Python patterns):
```javascript
// Save session ONCE
await saveSession("github.com/login", "github_session")
// User logs in manually with 2FA, captcha, etc.

// Reuse session FOREVER
await recordWithSession("github.com/repo", "github_session")
// Already authenticated!
```

**Key Features**:
- Save cookies, localStorage, sessionStorage
- Share sessions across recordings
- Skip login in automation playback
- Support complex auth (2FA, SSO, captcha)

### 3️⃣ Full Context Capture

#### Browser Context (Playwright)
- CSS selectors
- XPath  
- Element text
- DOM structure
- Form values
- Network requests

#### Desktop File Context
**macOS**: 
```javascript
// AppleScript for Finder
tell application "Finder"
  get selection as POSIX path
end tell
// Returns: "/Users/andrew/Training-Claude-Code/2.Lesson-2"
```

**Windows**:
```javascript
// PowerShell for Explorer
Get-ChildItem | Where-Object {$_.Selected}
```

#### Application Context
- Excel: Cell addresses, formulas
- Word: Paragraph, selection
- PDF: Page number, text selection

### 4️⃣ AI Interpretation Layer
**After each marked action**:
```javascript
User Action: Click on "2.Lesson-2" folder
AI Interprets: "Opening lesson 2 folder to access training materials"

Quick Confirm Dialog:
┌────────────────────────────────────┐
│ ✓ Opening folder "2.Lesson-2"?     │
│   To: Access training materials     │
│                                     │
│ [Confirm] [Edit] [Skip]            │
└────────────────────────────────────┘
```

**AI Capabilities**:
- Understand action intent
- Suggest purpose/reason
- Group related actions
- Learn user patterns
- Generate meaningful step descriptions

### 5️⃣ Enhanced Playback Engine
**From Python Recorder Patterns**:
- Headless or visible playback
- Slow motion for debugging
- Loop support (run N times)
- Error screenshots
- Wait injection for stability

---

## 📐 Technical Architecture

### Core Modules Structure
```
src/
├── main/
│   ├── capture-service.js              # Core orchestrator
│   ├── mark-before-handler.js          # NEW: Smart mark boundaries
│   ├── session-manager.js              # NEW: Browser session persistence
│   ├── context-enrichers/              # Modular context providers
│   │   ├── browser-context.js          # Playwright integration
│   │   ├── finder-context.js           # macOS Finder paths
│   │   ├── explorer-context.js         # Windows Explorer paths
│   │   └── app-specific/               # App-specific enrichers
│   │       ├── excel-context.js
│   │       ├── vscode-context.js
│   │       └── terminal-context.js
│   └── ai-interpreter.js               # NEW: AI understanding layer
│
├── renderer/
│   ├── js/
│   │   ├── smart-capture-ui.js         # NEW: Mark before UI
│   │   ├── session-ui.js               # NEW: Session management UI
│   │   ├── playback-engine.js          # NEW: Recording playback
│   │   └── ai-confirm-dialog.js        # NEW: AI interpretation UI
│   └── css/
│       └── next-gen-ui.css             # NEW: Enhanced UI styles
│
└── sessions/                            # NEW: Saved browser sessions
    ├── github.json
    ├── salesforce.json
    └── internal-app.json
```

### Data Flow Architecture
```
Mark Before Pressed
    ↓
Smart Capture Mode Active
    ↓
User Performs Action
    ↓
Context Enrichers Run (Parallel)
    ├── Browser Context (if web)
    ├── File Path Context (if desktop)
    └── App-Specific Context
    ↓
AI Interprets Complete Action
    ↓
Quick Confirm with User
    ↓
Save Enriched Step with:
    - Full context
    - AI interpretation
    - User confirmation
    - Replay-ready selectors
```

---

## 🛠️ Implementation Plan

### Week 1: Mark Before Foundation
**Priority**: HIGHEST
**Goal**: Implement smart capture boundaries

**Tasks**:
1. [ ] Create mark-before-handler.js
2. [ ] Implement smart completion detection
3. [ ] Add floating indicator UI
4. [ ] Group keystrokes into complete inputs
5. [ ] Add "why" prompt before action
6. [ ] Test with forms, files, navigation

**Success Metrics**:
- Keystrokes grouped as complete words/phrases
- Clear start/end for each marked action
- 90% accuracy in completion detection

### Week 2: Session Persistence + Browser Integration  
**Priority**: HIGH
**Goal**: Login once, use everywhere + Full browser context

**Tasks**:
1. [ ] Port Python session manager to JavaScript
2. [ ] Create session save/load UI
3. [ ] Integrate Playwright for selector capture
4. [ ] Add browser context enricher
5. [ ] Test with complex auth sites (2FA, SSO)
6. [ ] Implement smart wait injection

**Success Metrics**:
- Sessions persist across app restarts
- Complex auth sites work (GitHub, Google, etc.)
- Selectors captured for all browser actions

### Week 3: Desktop Context + AI Layer
**Priority**: MEDIUM
**Goal**: Capture file paths and understand user intent

**Tasks**:
1. [ ] Implement Finder context (macOS)
2. [ ] Implement Explorer context (Windows)
3. [ ] Add AI interpretation service
4. [ ] Create quick confirm dialog
5. [ ] Train AI on common patterns
6. [ ] Test with real workflows

**Success Metrics**:
- File paths captured accurately
- AI interpretations 80% accurate
- User corrections improve AI

### Week 4: Playback Engine + Polish
**Priority**: MEDIUM
**Goal**: Replay recorded processes

**Tasks**:
1. [ ] Port Python playback patterns
2. [ ] Add headless/headed modes
3. [ ] Implement loop support
4. [ ] Add error recovery
5. [ ] Create playback UI
6. [ ] Full integration testing

---

## 🎯 Success Criteria

### Must Have (MVP)
- [x] System-wide keystroke capture
- [x] Manual save/load with clear functionality
- [ ] Mark Before pattern working
- [ ] Browser session persistence
- [ ] Basic AI interpretation
- [ ] Export to Playwright code

### Should Have
- [ ] Desktop file path capture
- [ ] Playback engine
- [ ] Multiple session management
- [ ] Smart completion detection for all app types

### Nice to Have  
- [ ] Excel/Word specific context
- [ ] Video replay of sessions
- [ ] Team sharing of sessions
- [ ] Cloud backup of recordings

---

## 📊 Technical Decisions

### Why Mark Before?
- **Problem**: Mark after captures noise
- **Solution**: Mark before captures intent
- **Impact**: 10x cleaner data

### Why Session Persistence?
- **Problem**: Auth is painful
- **Solution**: Login once, reuse forever
- **Impact**: Hours saved per user

### Why Playwright?
- **Problem**: No context in clicks
- **Solution**: Full DOM selectors
- **Impact**: Reliable automation

### Why AI Interpretation?
- **Problem**: Raw actions lack meaning
- **Solution**: AI understands intent
- **Impact**: Self-documenting processes

---

## 🚧 Known Challenges

### Challenge 1: Async Coordination
**Issue**: Browser, desktop, and app contexts arrive at different times
**Solution**: Promise.all with timeout fallbacks

### Challenge 2: Cross-Platform Paths
**Issue**: File paths different on Mac/Windows
**Solution**: Platform-specific enrichers with common interface

### Challenge 3: AI Accuracy
**Issue**: AI might misinterpret actions
**Solution**: Quick confirm with learning from corrections

---

## 📈 Metrics & KPIs

### User Experience
- Time to capture process: < 5 min
- Accuracy of capture: > 95%
- User corrections needed: < 10%

### Technical Performance  
- Context enrichment time: < 100ms
- AI interpretation time: < 500ms
- Session save time: < 2s

### Business Impact
- Processes documented: Target 100
- Time saved per process: > 2 hours
- Automation success rate: > 90%

---

## 🔄 Version History

### V2.0 (Current - 2025-08-11)
- Mark Before pattern design
- Session persistence from Python
- AI interpretation layer planned
- Full context capture architecture

### V1.0 (2025-08-10)
- Basic capture working
- System-wide keystrokes
- Three-panel UI
- Manual save/clear

---

## 📚 References & Inspiration

### Python Browser Recorder
- Session persistence pattern
- Smart wait injection
- Enhanced recording pattern
- Playback engine design

### UiPath / RPA Tools
- Element selector capture
- Workflow branching
- Error recovery patterns

### Our Innovations
- Mark Before pattern (unique)
- AI interpretation layer (unique)
- Conversational capture (unique)

---

## ✅ Next Immediate Actions

1. **TODAY**: Implement Mark Before basic structure
2. **TODAY**: Add smart completion detection for forms
3. **TOMORROW**: Test with real workflows
4. **THIS WEEK**: Complete Mark Before pattern
5. **NEXT WEEK**: Start session persistence

---

*This is a living document - update after each session*
*Last major revision: 2025-08-11 by Claude & Andrew*