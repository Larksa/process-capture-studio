/**
 * Preload Script - Secure bridge between renderer and main process
 * Exposes limited API to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Generic send method for compatibility
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    
    // Capture controls
    startCapture: () => ipcRenderer.send('capture:start'),
    stopCapture: () => ipcRenderer.send('capture:stop'),
    markImportant: (data) => ipcRenderer.send('capture:mark', data),
    
    // Listen for capture events
    onCaptureActivity: (callback) => {
        ipcRenderer.on('capture:activity', (event, data) => callback(data));
    },
    
    // Listen for Python capture events (file system, Excel, etc)
    onPythonEvent: (callback) => {
        ipcRenderer.on('capture:python-event', (event, data) => callback(data));
    },
    
    // Step Boundary methods
    startStep: (data) => ipcRenderer.invoke('step:start', data),
    endStep: (data) => ipcRenderer.invoke('step:end', data),
    getStepStatus: () => ipcRenderer.invoke('step:status'),
    
    // Step Boundary events
    onStepStarted: (callback) => {
        ipcRenderer.on('step:started', (event, data) => callback(data));
    },
    onStepCompleted: (callback) => {
        ipcRenderer.on('step:completed', (event, data) => callback(data));
    },
    onStepEventAdded: (callback) => {
        ipcRenderer.on('step:event-added', (event, data) => callback(data));
    },
    
    // Mark mode events
    onMarkModeStarted: (callback) => {
        ipcRenderer.on('mark:mode-started', (event, data) => callback(data));
    },
    onMarkModeStopped: (callback) => {
        ipcRenderer.on('mark:mode-stopped', (event, data) => callback(data));
    },
    onMarkCompleted: (callback) => {
        ipcRenderer.on('mark:completed', (event, data) => callback(data));
    },
    onMarkBeforePrompt: (callback) => {
        ipcRenderer.on('mark-before:prompt', (event, data) => callback(data));
    },
    getMarkStatus: () => ipcRenderer.invoke('mark:status'),
    
    // Inactivity detection events
    onMarkInactivityDetected: (callback) => {
        ipcRenderer.on('mark:inactivity-detected', (event, data) => callback(data));
    },
    handleInactivityResponse: (response, details) => {
        return ipcRenderer.invoke('mark-before:inactivity-response', { response, details });
    },
    onSideQuestStarted: (callback) => {
        ipcRenderer.on('mark:side-quest-started', (event, data) => callback(data));
    },
    onSideQuestCompleted: (callback) => {
        ipcRenderer.on('mark:side-quest-completed', (event, data) => callback(data));
    },
    onCaptureResumed: (callback) => {
        ipcRenderer.on('mark:capture-resumed', (event) => callback());
    },
    
    // Generic invoke for new handlers
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    
    // Keyboard shortcuts
    onShortcut: (shortcut, callback) => {
        ipcRenderer.on(`shortcut:${shortcut}`, callback);
    },
    
    // Window controls
    setAlwaysOnTop: (enabled) => ipcRenderer.send('window:always-on-top', enabled),
    setOpacity: (opacity) => ipcRenderer.send('window:opacity', opacity),
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    maximizeWindow: () => ipcRenderer.send('window:maximize'),
    closeWindow: () => ipcRenderer.send('window:close'),
    
    // System information
    getActiveApp: () => ipcRenderer.invoke('system:get-active-app'),
    getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
    
    // File operations
    saveFile: (data) => ipcRenderer.invoke('export:save-file', data),
    
    // Browser capture controls
    // launchCaptureBrowser removed - using worker browser only
    getBrowserStatus: () => ipcRenderer.invoke('browser:get-status'),
    onBrowserStatusUpdate: (callback) => {
        ipcRenderer.on('browser:status-update', (event, data) => callback(data));
    },
    
    // Session management
    captureSession: () => ipcRenderer.invoke('session:capture'),
    loadSession: (sessionState) => ipcRenderer.invoke('session:load', sessionState),
    refreshSession: (sessionState) => ipcRenderer.invoke('session:refresh', sessionState),
    
    // Platform detection
    platform: process.platform,
    
    // Version info
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    },
    
    // Replay functionality
    startReplay: (options) => ipcRenderer.invoke('replay:start', options),
    pauseReplay: () => ipcRenderer.invoke('replay:pause'),
    resumeReplay: () => ipcRenderer.invoke('replay:resume'),
    stopReplay: () => ipcRenderer.invoke('replay:stop'),
    nextReplayStep: () => ipcRenderer.invoke('replay:next-step'),
    
    // Replay event listeners
    onReplayStatus: (callback) => {
        ipcRenderer.on('replay:status', (event, data) => callback(data));
    },
    onReplayLog: (callback) => {
        ipcRenderer.on('replay:log', (event, data) => callback(data));
    }
});

// Log that preload script is loaded
console.log('Preload script loaded successfully');