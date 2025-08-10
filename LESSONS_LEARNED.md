# Lessons Learned - Process Capture Studio

## 🧠 Skills & Insights Gained

### Technical Skills

#### **Electron System-Wide Capture**
- **Depth**: Beginner → Advanced
- **Key insight**: iohook is deprecated for Electron 27+, use uiohook-napi instead
- **Future applications**: Any desktop automation tool, keystroke loggers, workflow capture
- **Critical learning**: Must handle native module rebuilding for each Electron version

#### **macOS Accessibility Permissions**
- **Depth**: Intermediate → Advanced  
- **Key insight**: Terminal needs separate accessibility permissions from the Electron app
- **Future applications**: Any macOS app requiring system-wide input monitoring
- **API learned**: `systemPreferences.isTrustedAccessibilityClient()`

#### **Console EPIPE Error Handling**
- **Depth**: Problem discovered → Solution mastered
- **Key insight**: Excessive console.log in event loops causes pipe overflow and crashes
- **Future applications**: Any high-frequency event handling system
- **Solution pattern**: Safe logging wrapper + debug mode flag

### Conceptual Understanding

#### **IPC Communication in Electron**
- **What clicked**: Renderer must explicitly tell main process to start capture service
- **Mental model**: Two separate processes need explicit bridge for system-level operations
- **Related to**: Any Electron app with system-wide features

#### **Event Capture Architecture**
- **What clicked**: Browser can only capture its own events, need native modules for system-wide
- **Mental model**: Three layers - Browser events → Electron IPC → Native OS hooks
- **Related to**: Security sandboxing, process isolation

## 🔄 Workflow Patterns

### **Electron Native Module Integration**
- **Workflow**: Install → Rebuild for Electron → Handle permissions → Test
- **What worked**: Using electron-builder install-app-deps for rebuilding
- **Gotchas**: Prebuilt binaries rarely match Electron version
- **Reusable**: Yes - same pattern for any native module

## ❌ Problems Solved

### **EPIPE crash on Cmd+Shift+M**
- **Time to solve**: 30 minutes
- **Solution**: Remove excessive logging, add safe log wrapper
- **Reusable pattern?**: Yes

### **System-wide capture not working**
- **Time to solve**: 3 hours
- **Solution**: Fix IPC communication + correct uiohook-napi API usage
- **Reusable pattern?**: Yes

## 🚨 Gotchas Encountered

### **Technology**: uiohook-napi
- **Issue**: API different from docs - must destructure `{ uIOhook }`
- **Fix**: `const { uIOhook } = require('uiohook-napi')`
- **Time wasted**: 1 hour

### **Technology**: macOS Accessibility
- **Issue**: App has permission but still not working
- **Fix**: Terminal needs separate permission in dev
- **Time wasted**: 30 minutes

## 🔑 Key Takeaways

1. **Console logging can crash your app** in high-frequency scenarios
2. **macOS permissions are complex** - Terminal and app need separate permissions
3. **IPC communication must be explicit** - renderer won't trigger main automatically
4. **Always check native module compatibility** with Electron version

## 📚 Resources for Future

- [uiohook-napi](https://www.npmjs.com/package/uiohook-napi) - Modern iohook replacement
- [active-win](https://www.npmjs.com/package/active-win) - Active window detection
- `electron-builder install-app-deps` - Rebuild native modules
- `DEBUG_CAPTURE=true` pattern - Conditional debug logging
EOF < /dev/null