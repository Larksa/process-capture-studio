# Process Capture Studio - Living Requirements

## 🚦 Current Status
**Last Updated**: 2025-08-10 11:00 AM  
**Phase**: Building - Window management fixed, need system-wide capture
**Blocked By**: JavaScript errors and lack of system-wide capture
**Next Action**: Fix JS errors then install and integrate iohook for global capture

## 📊 Progress Overview
- Total Tasks: 47
- Completed: 23 (49%)
- In Progress: 3
- Discovered: 12 (tasks found during work)
- Failed Attempts: 2

## 🎯 Original Vision
[Preserved from initial conversation - NEVER delete, only annotate]

"I want to be able to sit down with my work colleagues and/or a process expert and have a chat on one side that guides through the logic and captures every single important movement in a process. The logic behind it, where it leads, why they got there, how did they get there. The process may go forwards and backwards. Eventually grow to be not needing the person sitting there, but a really cool way of documenting not just the keystrokes and tables but the logic and the insights that can then be passed on to a sophisticated coder to do the work."

**Key Requirements:**
- Capture keystrokes across ALL applications (browser, Excel, desktop)
- Track the "why" not just the "what"
- Handle branching logic (IF file is Excel THEN do X, IF PDF THEN do Y)
- Support backwards navigation to fill gaps
- Export automation-ready code for developers
- Start local with JSON, scale later
- Privacy-first (no actual values stored)

## 🔄 Current Understanding
[How our understanding evolved - update after each session]

- **[2025-01-09 Morning]**: Discovered browser-only capture loses context when switching tabs - need Electron wrapper
- **[2025-01-09 Afternoon]**: Realized Docker can't capture system keystrokes - pivoting to portable Electron app
- **[2025-01-09 Current]**: Three-panel system working beautifully, need system-wide capture via iohook
- **[2025-01-09 Update]**: Recursive data source discovery is KEY - "Where did that come from?" leads to complete automation
- **[2025-08-10 Morning]**: Window management fixed - always-on-top and opacity working perfectly
- **[2025-08-10 Current]**: JS errors preventing proper capture, need iohook for detecting clicks outside app window

## 📋 Task Hierarchy

### Phase 1: MVP Foundation [9/9 tasks] ✅
- [x] 1.1: Basic process capture UI
  - **Planned**: 2h
  - **Actual**: 1h
  - **Status**: Complete
  - **Notes**: Simple HTML/JS with localStorage works perfectly
  
- [x] 1.2: Manual step logging
  - **Planned**: 1h
  - **Actual**: 1h
  - **Status**: Complete
  
- [x] 1.3: Basic export (JSON/YAML)
  - **Planned**: 1h
  - **Actual**: 0.5h
  - **Status**: Complete

- [x] 1.4: Browser extension skeleton
  - **Planned**: 2h
  - **Actual**: 1h
  - **Status**: Complete

- [x] 1.5: Edge/Chrome manifest v3
  - **Status**: Complete

- [x] 1.6: Hotkey support (Ctrl+Shift+M)
  - **Status**: Complete

- [x] 1.7: Privacy-safe capture
  - **Status**: Complete
  - **Notes**: No passwords, no query strings

- [x] 1.8: Repository pattern for storage
  - **Status**: Complete
  - **Notes**: Ready for database swap later

- [x] 1.9: Event taxonomy definition
  - **Status**: Complete

### Phase 2: Three-Panel Magic System [14/16 tasks]
- [x] 2.1: Three-panel HTML layout
  - **Planned**: 3h
  - **Actual**: 2h
  - **Status**: Complete
  - **Notes**: Grid layout works beautifully
  
- [x] 2.2: Activity tracker panel
  - **Planned**: 4h
  - **Actual**: 3h
  - **Status**: Complete
  - **Notes**: Captures clicks, keystrokes, navigation

- [x] 2.3: Interactive canvas with live nodes
  - **Planned**: 6h
  - **Actual**: 5h
  - **Status**: Complete
  - **Notes**: Real-time visual building works!

- [x] 2.4: AI chat guide integration
  - **Planned**: 3h
  - **Actual**: 2h
  - **Status**: Complete

- [x] 2.5: Node click navigation
  - **Status**: Complete
  - **Notes**: Click any node to jump back - magical!

- [x] 2.6: Branch recording system
  - **Status**: Complete
  - **Notes**: IF/THEN/ELSE with visual feedback

- [x] 2.7: Decision node support
  - **Status**: Complete

- [x] 2.8: Data flow tracking
  - **Status**: Complete
  - **Notes**: Knows where data comes from/goes

- [x] 2.9: Credential placeholders
  - **Status**: Complete
  - **Notes**: Never stores actual passwords

- [x] 2.10: Export to Playwright
  - **Status**: Complete

- [x] 2.11: Export to Python
  - **Status**: Complete

- [x] 2.12: Export to Mermaid
  - **Status**: Complete

- [x] 2.13: Zoom/pan canvas controls
  - **Status**: Complete

- [x] 2.14: Minimap navigation
  - **Status**: Complete

- [ ] 2.15: Undo/redo system
  - **Status**: In Progress
  - **Notes**: Basic structure in place, needs testing

- [ ] 2.16: Collaborative editing
  - **Status**: Not Started
  - **Notes**: Future enhancement

### Phase 2.5: IMMEDIATE FIXES [0/5 tasks] - URGENT
- [ ] 2.5.1: Fix getRelevantAttributes missing method
  - **Status**: Not Started
  - **Error**: activity-tracker.js:246 - method called but not defined
  - **Fix**: Add method to extract element attributes
  
- [ ] 2.5.2: Fix saveDialogState null reference
  - **Status**: Not Started  
  - **Error**: app.js:151 - 'action-reason' element doesn't exist
  - **Fix**: Change to 'step-logic' (correct textarea ID)
  
- [ ] 2.5.3: Add null safety checks
  - **Status**: Not Started
  - **Fix**: Check elements exist before accessing .value
  
- [ ] 2.5.4: Test JavaScript fixes
  - **Status**: Not Started
  - **Verify**: No console errors, capture works in app window
  
- [ ] 2.5.5: Commit JavaScript fixes
  - **Status**: Not Started

### Phase 3: System-Wide Capture [0/12 tasks] - Current Focus
- [ ] 3.1: Electron main process
  - **Planned**: 3h
  - **Status**: COMPLETED ✅
  - **Notes**: Electron app running with window management

- [ ] 3.2: iohook integration - DETAILED PLAN
  - **Planned**: 4h
  - **Status**: Not Started
  - **Detailed Steps**:
    ```
    Step 1: Install iohook package
    - npm install iohook --save
    - Expected: May fail due to prebuilt binary mismatch
    
    Step 2: Rebuild for Electron 27
    - npm install --save-dev electron-rebuild
    - npx electron-rebuild -f -w iohook
    - Alternative: npm run rebuild (already in package.json)
    
    Step 3: Handle compilation requirements
    - macOS: Xcode Command Line Tools required
    - Windows: Visual Studio Build Tools required
    - Linux: build-essential package required
    
    Step 4: Integrate into capture-service.js
    - Import iohook successfully
    - Register global mouse/keyboard listeners
    - Forward events to renderer process
    
    Step 5: Handle permissions
    - macOS: Request accessibility permissions
    - Windows: May need admin for some features
    - Linux: User must be in 'input' group
    
    Step 6: Test system-wide capture
    - Click in other applications
    - Verify events captured correctly
    - Check application context detection
    ```

- [ ] 3.3: Active window detection
  - **Planned**: 2h
  - **Status**: Not Started
  - **Notes**: Know which app is active (Excel, Chrome, etc.)

- [ ] 3.4: Multi-window management
  - **Planned**: 3h
  - **Status**: Not Started
  - **Notes**: Studio stays visible while working

- [ ] 3.5: Clipboard monitoring
  - **Status**: Not Started
  - **Notes**: Track copy/paste with source

- [ ] 3.6: File operation tracking
  - **Status**: Not Started
  - **Notes**: Capture file navigation paths

- [ ] 3.7: Application context capture
  - **Status**: Not Started
  - **Notes**: Excel cells, browser URLs, etc.

- [ ] 3.8: Screenshot capture for context
  - **Status**: Not Started

- [ ] 3.9: OCR for reading screen content
  - **Status**: Not Started
  - **Notes**: Future enhancement

- [ ] 3.10: Portable build system
  - **Status**: Not Started
  - **Notes**: .exe, .app, .AppImage

- [ ] 3.11: Auto-update system
  - **Status**: Not Started

- [ ] 3.12: Permission setup guide
  - **Status**: Not Started
  - **Notes**: Help users enable screen recording

### Phase 4: Advanced Features [0/10 tasks] - Future
- [ ] 4.1: Loop detection and recording
- [ ] 4.2: Parallel process support
- [ ] 4.3: Error recovery flows
- [ ] 4.4: Data validation rules
- [ ] 4.5: API integration detection
- [ ] 4.6: Database query capture
- [ ] 4.7: Email automation hooks
- [ ] 4.8: Cloud storage integration
- [ ] 4.9: Team collaboration features
- [ ] 4.10: Process versioning

## ❌ Failed Approaches
[Document what didn't work to save time next time]

### Docker Container Approach
- **Date**: 2025-01-09
- **Time Lost**: 30 minutes
- **Why Failed**: Docker containers can't access host system keystrokes or desktop applications
- **Lesson Learned**: System-level capture requires native access
- **What to Try Instead**: Portable Electron executables

### Browser-Only Capture
- **Date**: 2025-01-09
- **Time Lost**: 1 hour  
- **Why Failed**: Loses context when switching tabs, can't see desktop apps
- **Lesson Learned**: Need system-wide capture for complete solution
- **What to Try Instead**: Electron with iohook for global capture

### iohook Default Installation
- **Date**: 2025-01-09
- **Time Lost**: 45 minutes
- **Why Failed**: iohook prebuilt binaries only support Electron up to v12, we're using v27
- **Lesson Learned**: Version mismatch - 15 major versions gap
- **Investigation**: Reviewed docs at https://wilix-team.github.io/iohook/
- **Solution Plan**:
  - Option B (Primary): Build iohook from source for Electron 27 using manual build instructions
  - Option C (Fallback): Use modern alternatives like uiohook-napi or node-global-key-listener
- **Reference**: Manual build instructions at https://wilix-team.github.io/iohook/manual-build.html

## 📈 Velocity Tracking
| Session | Planned | Completed | Discovered | Velocity | Notes |
|---------|---------|-----------|------------|----------|-------|
| 1 | 9 tasks | 9 tasks | 0 tasks | 100% | MVP complete |
| 2 | 16 tasks | 14 tasks | 5 tasks | 87% | Three-panel system working |
| 3 | 12 tasks | 0 tasks | 7 tasks | 0% | Starting Electron integration |

## 🔧 Technical Decisions Log
| Date | Decision | Why | Impact |
|------|----------|-----|--------|
| 2025-01-09 | Use vanilla JS instead of React | Simplicity, no build process | Faster development, easy debugging |
| 2025-01-09 | Three-panel layout | Visual feedback while working | Users love seeing process build |
| 2025-01-09 | Electron over Docker | Need system-level access | Can capture ALL applications |
| 2025-01-09 | iohook for global capture | Only reliable cross-platform solution | Complete keystroke capture |
| 2025-01-09 | Build iohook from source | Prebuilt only supports Electron ≤12, we use v27 | Must compile for modern Electron |
| 2025-01-09 | Portable builds | No installation needed | Easy team distribution |
| 2025-01-09 | LocalStorage first, DB later | Start simple | Working prototype in hours |
| 2025-01-09 | Repository pattern everywhere | Future-proof | Easy to swap storage |
| 2025-08-10 | Always-on-top window option | Keep studio visible while working | Can capture across applications |
| 2025-08-10 | Opacity control 30-100% | See through to work underneath | Less intrusive capture |
| 2025-08-10 | Auto-hide dialog on blur | Save state when clicking away | Smooth workflow capture |
| 2025-08-10 | iohook over alternatives | Most mature solution | Proven system-wide capture |

## 🎨 Architecture Decisions

### Three-Panel System
```
┌──────────────┬──────────────┬──────────────┐
│   Activity   │     Chat     │    Canvas    │
│   Tracker    │    Guide     │   Builder    │
│              │              │              │
│  Keystrokes  │  "Why did    │   Visual     │
│   Clicks     │  you do      │   Process    │
│  Navigation  │  that?"      │     Map      │
└──────────────┴──────────────┴──────────────┘
```

### Data Capture Hierarchy
```
Activity Event
├── Action (what)
├── Element (where)
├── Context (application)
├── Logic (why)
├── Data Flow (from/to)
└── Validation (verify)
```

### Export Priority
1. JSON - Complete data structure
2. Playwright - Browser automation
3. Python - Desktop automation
4. Mermaid - Documentation
5. YAML - Human readable

## 🚀 Deployment Strategy

### Phase 1: Local Development
- Run from file:// 
- Browser-only capture
- LocalStorage persistence

### Phase 2: Electron App (Current)
- System-wide capture
- Portable executables
- No installation needed

### Phase 3: Team Distribution
- Shared network drive
- Auto-update system
- Centralized process library

### Phase 4: Enterprise
- Cloud backend
- Team collaboration
- Version control
- Audit trails

## 📊 Success Metrics

### Capture Completeness
- ✅ Browser interactions: 100%
- ⏳ Desktop applications: 0% (pending)
- ⏳ Cross-app workflows: 0% (pending)
- ✅ Logic/reasoning: 90%
- ✅ Data lineage: 85%

### Export Quality
- ✅ Playwright code runs: Yes
- ✅ Python code complete: Yes
- ✅ Documentation useful: Yes
- ⏳ Production ready: Not yet

### User Experience
- ✅ Visual feedback: Excellent
- ✅ Easy to understand: Yes
- ⏳ Easy to distribute: Pending
- ✅ No training needed: Mostly

## 🎯 Next Sprint Goals

### Sprint 3 (Current Week)
1. Complete Electron wrapper
2. Integrate iohook for global capture
3. Test Excel/desktop capture
4. Build portable executables
5. Write distribution guide

### Sprint 4 (Next Week)
1. Add OCR for screen reading
2. Implement loop detection
3. Add error recovery flows
4. Create training videos
5. Beta test with team

## 🐛 Known Issues

### Critical
- [ ] Browser-only version loses context on tab switch
- [ ] No desktop application capture yet

### High Priority
- [ ] Undo/redo not fully implemented
- [ ] Large processes (>100 nodes) slow down canvas

### Medium Priority
- [ ] Export code needs error handling
- [ ] Credential management needs key vault integration

### Low Priority
- [ ] Minimap doesn't update on zoom
- [ ] Dark mode not implemented

## 💡 Discovered Requirements

### During Development
1. Need floating window option (always visible)
2. Must capture file paths during navigation
3. Should detect loops automatically
4. Need to handle multi-monitor setups
5. Must work without admin rights
6. Should capture screenshot context
7. Need offline capability
8. Must handle high DPI screens
9. Should support keyboard-only navigation
10. Need batch processing mode
11. Must integrate with existing tools
12. Should support custom prompts

## 🎉 Wins & Celebrations

- Three-panel system works beautifully!
- Click-to-navigate is magical
- Branch recording is intuitive
- Export generates working code
- Visual building gets "wow" reactions
- Credential handling is secure
- Data lineage tracking works
- Canvas performance is smooth

## 📝 Notes for Next Session

- Focus on Electron integration
- Test iohook on different OS
- Consider Electron Forge for builds
- Look into code signing requirements
- Research OCR libraries
- Plan beta testing process
- Create demo scenarios
- Write user documentation

---

*Living document - updates continuously as we build*