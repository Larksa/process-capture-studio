/**
 * Process Capture Studio - Main Electron Process
 * Handles application lifecycle and window management
 */

const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, screen, dialog } = require('electron');
const path = require('path');
const CaptureService = require('./capture-service');
const WindowManager = require('./window-manager');
const MarkBeforeHandler = require('./mark-before-handler');

// Keep references to avoid garbage collection
let mainWindow = null;
let captureService = null;
let windowManager = null;
let markBeforeHandler = null;
let tray = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Global error handlers to prevent app crashes
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Show error dialog but don't crash
    if (mainWindow) {
        dialog.showErrorBox('Unexpected Error', 
            `An error occurred: ${error.message}\n\nThe app will continue running.`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Create the main application window
 */
function createMainWindow() {
    // Get primary display dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Create main window
    mainWindow = new BrowserWindow({
        width: Math.min(1400, width * 0.9),
        height: Math.min(900, height * 0.9),
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
        title: 'Process Capture Studio',
        backgroundColor: '#ffffff',
        show: false, // Don't show until ready
        alwaysOnTop: false, // Can be toggled via UI
        skipTaskbar: false,
        focusable: true,
        frame: true,
        hasShadow: true
    });

    // Load the app
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Initialize services
        initializeServices();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Setup window manager
    windowManager = new WindowManager(mainWindow);
}

/**
 * Initialize capture and other services
 */
function initializeServices() {
    // Initialize capture service
    captureService = new CaptureService();
    
    // Initialize mark before handler
    markBeforeHandler = new MarkBeforeHandler();
    if (mainWindow) {
        markBeforeHandler.init(mainWindow);
    }
    
    // Start capture service
    captureService.initialize();
    
    // Pass main window bounds to capture service
    updateWindowBounds();
    
    // Update bounds when window moves or resizes
    mainWindow.on('move', updateWindowBounds);
    mainWindow.on('resize', updateWindowBounds);
    
    // Forward capture events to renderer AND mark handler
    captureService.on('activity', (data) => {
        // Always send to renderer for UI updates
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('capture:activity', data);
        }
        
        // If mark mode is active, also process in mark handler
        if (markBeforeHandler && markBeforeHandler.isActive()) {
            markBeforeHandler.processEvent(data);
        }
    });

    // Setup global shortcuts
    setupGlobalShortcuts();
    
    // Setup IPC handlers
    setupIpcHandlers();
    
    // Create system tray
    createTray();
}

/**
 * Update window bounds in capture service
 */
function updateWindowBounds() {
    if (mainWindow && captureService) {
        const bounds = mainWindow.getBounds();
        captureService.setMainWindowBounds(bounds);
    }
}

/**
 * Setup global keyboard shortcuts
 */
function setupGlobalShortcuts() {
    // Mark important step - now uses Mark Before pattern
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (markBeforeHandler) {
            if (markBeforeHandler.isActive()) {
                // If already in mark mode, stop and start a new one
                const capturedData = markBeforeHandler.stopMarkMode('new-mark-started');
                if (capturedData && mainWindow) {
                    mainWindow.webContents.send('mark:completed', capturedData);
                }
                markBeforeHandler.startMarkMode();
            } else {
                // Start mark mode
                markBeforeHandler.startMarkMode();
                // Set completion callback
                markBeforeHandler.onCompletion((result) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('mark:completed', result);
                    }
                });
            }
        }
    });

    // Start/stop capture
    globalShortcut.register('CommandOrControl+Shift+S', () => {
        if (mainWindow) {
            mainWindow.webContents.send('shortcut:toggle-capture');
        }
    });

    // Quick export
    globalShortcut.register('CommandOrControl+E', () => {
        if (mainWindow) {
            mainWindow.webContents.send('shortcut:export');
        }
    });

    // Toggle window visibility
    globalShortcut.register('F9', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
            }
        }
    });
}

/**
 * Setup IPC communication handlers
 */
function setupIpcHandlers() {
    // Capture controls
    ipcMain.on('capture:start', () => {
        captureService.startCapture();
    });

    ipcMain.on('capture:stop', () => {
        captureService.stopCapture();
    });

    ipcMain.on('capture:mark', (event, data) => {
        // New mark before pattern
        if (data && data.action === 'start') {
            markBeforeHandler.startMarkMode(data.description);
            markBeforeHandler.onCompletion((result) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('mark:completed', result);
                }
            });
        } else if (data && data.action === 'stop') {
            const result = markBeforeHandler.stopMarkMode('manual-stop');
            if (result && mainWindow) {
                mainWindow.webContents.send('mark:completed', result);
            }
        } else {
            // Legacy support
            captureService.markImportant(data);
        }
    });
    
    // Mark mode status
    ipcMain.handle('mark:status', () => {
        if (markBeforeHandler) {
            return {
                active: markBeforeHandler.isActive(),
                eventCount: markBeforeHandler.getEventCount(),
                currentText: markBeforeHandler.getCurrentText()
            };
        }
        return { active: false, eventCount: 0, currentText: '' };
    });

    // Window controls
    ipcMain.on('window:always-on-top', (event, enabled) => {
        console.log('Setting always on top:', enabled);
        windowManager.setAlwaysOnTop(enabled);
    });

    ipcMain.on('window:opacity', (event, opacity) => {
        console.log('Setting opacity:', opacity);
        windowManager.setOpacity(opacity);
    });

    ipcMain.on('window:minimize', () => {
        mainWindow.minimize();
    });

    ipcMain.on('window:maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    ipcMain.on('window:close', () => {
        mainWindow.close();
    });

    // Get active application info
    ipcMain.handle('system:get-active-app', async () => {
        return captureService.getActiveApplication();
    });

    // Get system info
    ipcMain.handle('system:get-info', async () => {
        return {
            platform: process.platform,
            version: app.getVersion(),
            electron: process.versions.electron,
            node: process.versions.node
        };
    });

    // Export functions
    ipcMain.handle('export:save-file', async (event, data) => {
        const { dialog } = require('electron');
        const fs = require('fs').promises;
        
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: data.filters,
            defaultPath: data.defaultPath
        });
        
        if (!result.canceled) {
            await fs.writeFile(result.filePath, data.content);
            return result.filePath;
        }
        
        return null;
    });
}

/**
 * Create system tray icon
 */
function createTray() {
    tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Studio',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                }
            }
        },
        {
            label: 'Start Capture',
            click: () => {
                if (captureService) {
                    captureService.startCapture();
                }
            }
        },
        {
            label: 'Stop Capture',
            click: () => {
                if (captureService) {
                    captureService.stopCapture();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: false,
            click: (menuItem) => {
                if (windowManager) {
                    windowManager.setAlwaysOnTop(menuItem.checked);
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('Process Capture Studio');
    tray.setContextMenu(contextMenu);
    
    // Click to show/hide
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
            }
        }
    });
}

/**
 * Application event handlers
 */

// App ready
app.whenReady().then(() => {
    createMainWindow();
    
    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

// All windows closed
app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Before quit
app.on('before-quit', () => {
    // Cleanup
    if (captureService) {
        captureService.cleanup();
    }
    
    // Unregister shortcuts
    globalShortcut.unregisterAll();
});

// Will quit
app.on('will-quit', () => {
    // Final cleanup
    if (captureService) {
        captureService.cleanup();
    }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Prevent certificate errors in development
    if (process.env.NODE_ENV === 'development') {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});

// Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
    });
});

/**
 * Development helpers
 */
if (process.env.NODE_ENV === 'development') {
    // Enable live reload for Electron
    try {
        require('electron-reloader')(module);
    } catch {}
    
    // Open DevTools
    app.whenReady().then(() => {
        mainWindow.webContents.openDevTools();
    });
}

// Export for testing
module.exports = {
    createMainWindow,
    app
};