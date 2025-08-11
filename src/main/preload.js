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
    getMarkStatus: () => ipcRenderer.invoke('mark:status'),
    
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
    launchCaptureBrowser: () => ipcRenderer.invoke('browser:launch-capture'),
    getBrowserStatus: () => ipcRenderer.invoke('browser:get-status'),
    onBrowserStatusUpdate: (callback) => {
        ipcRenderer.on('browser:status-update', (event, data) => callback(data));
    },
    
    // Platform detection
    platform: process.platform,
    
    // Version info
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
});

// Log that preload script is loaded
console.log('Preload script loaded successfully');