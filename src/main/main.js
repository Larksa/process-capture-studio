/**
 * Process Capture Studio - Main Electron Process
 * Handles application lifecycle and window management
 */

const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, screen, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');
const CaptureService = require('./capture-service');
const WindowManager = require('./window-manager');
const MarkBeforeHandler = require('./mark-before-handler');

// Keep references to avoid garbage collection
let mainWindow = null;
let captureService = null;
let windowManager = null;
let markBeforeHandler = null;
let tray = null;
let browserWorker = null;
let browserWorkerRequests = new Map(); // Track pending requests

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
    
    // Initialize browser context worker
    initializeBrowserWorker();
    
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
 * Initialize browser context worker process
 */
function initializeBrowserWorker() {
    console.log('[Main] Initializing browser context worker...');
    
    // Fork the browser worker process
    browserWorker = fork(path.join(__dirname, 'browser-context-worker.js'), [], {
        silent: false, // Show worker console output in dev mode
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    
    // Handle messages from worker
    browserWorker.on('message', (message) => {
        const { id, type, success, data, error, event } = message;
        console.log(`[Main] Received from browser worker: type=${type}, id=${id}, success=${success}`);
        
        if (type === 'response') {
            // Handle response to a request
            const callback = browserWorkerRequests.get(id);
            if (callback) {
                browserWorkerRequests.delete(id);
                if (success) {
                    console.log(`[Main] Browser worker returned success for id=${id}`);
                    callback.resolve(data);
                } else {
                    console.error(`[Main] Browser worker returned error for id=${id}:`, error);
                    callback.reject(new Error(error));
                }
            } else {
                console.warn(`[Main] No callback found for browser worker response id=${id}`);
            }
        } else if (type === 'event') {
            // Handle worker events
            console.log(`[Main] Browser worker event: ${event}`, data);
            
            // Notify renderer of important events
            if (mainWindow && (event === 'reconnected' || event === 'connection_failed')) {
                mainWindow.webContents.send('browser:status', { event, data });
            }
        }
    });
    
    // Handle worker errors
    browserWorker.on('error', (error) => {
        console.error('[Main] Browser worker error:', error);
    });
    
    // Handle worker exit
    browserWorker.on('exit', (code, signal) => {
        console.log(`[Main] Browser worker exited with code ${code} and signal ${signal}`);
        browserWorker = null;
        
        // Attempt to restart after a delay
        setTimeout(() => {
            if (!browserWorker && !app.isQuitting) {
                console.log('[Main] Attempting to restart browser worker...');
                initializeBrowserWorker();
            }
        }, 5000);
    });
    
    // Pass browser context getter to capture service
    if (captureService) {
        captureService.setBrowserContextGetter(getBrowserElementAtPoint);
    }
}

/**
 * Send request to browser worker
 */
function sendToBrowserWorker(type, data = {}) {
    return new Promise((resolve, reject) => {
        if (!browserWorker) {
            console.error('[Main] Browser worker not initialized when trying to send:', type);
            reject(new Error('Browser worker not initialized'));
            return;
        }
        
        const id = Date.now() + Math.random();
        console.log(`[Main] Sending to browser worker: type=${type}, id=${id}`, data);
        browserWorkerRequests.set(id, { resolve, reject });
        
        // Set timeout for request
        setTimeout(() => {
            if (browserWorkerRequests.has(id)) {
                console.error(`[Main] Browser worker request timeout for: type=${type}, id=${id}`);
                browserWorkerRequests.delete(id);
                reject(new Error('Browser worker request timeout'));
            }
        }, 5000);
        
        browserWorker.send({ id, type, data });
    });
}

/**
 * Get browser element at specific coordinates
 */
async function getBrowserElementAtPoint(x, y) {
    console.log(`[Main] getBrowserElementAtPoint called with x=${x}, y=${y}`);
    
    try {
        const result = await sendToBrowserWorker('getElementAtPoint', { x, y });
        console.log('[Main] Browser element result:', result ? 'Element found' : 'No element');
        return result;
    } catch (error) {
        console.error('[Main] Failed to get browser element:', error.message);
        return null;
    }
}

/**
 * Setup global keyboard shortcuts
 */
function setupGlobalShortcuts() {
    // Mark important step - now uses Mark Before pattern with immediate intent dialog
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            // Send signal to renderer to show intent dialog IMMEDIATELY
            mainWindow.webContents.send('mark-before:prompt');
            
            // Bring window to front to ensure dialog is visible
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
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
    
    // New intent-first Mark Before handler
    ipcMain.handle('mark-before:start-with-intent', async (event, data) => {
        console.log('[Main] Starting Mark Before with intent:', data.intent);
        
        if (!markBeforeHandler) {
            return { success: false, error: 'Handler not initialized' };
        }
        
        // Start mark mode with user's declared intent
        markBeforeHandler.startMarkMode(data.intent);
        
        // Set up completion callback
        markBeforeHandler.onCompletion((result) => {
            console.log('[Main] Mark Before completed with', result.events?.length, 'events');
            if (mainWindow && !mainWindow.isDestroyed()) {
                // Include the original intent in the result
                result.intent = data.intent;
                result.description = data.intent; // Pre-fill description
                mainWindow.webContents.send('mark:completed', result);
            }
        });
        
        return { success: true, message: 'Capture started for 30 seconds' };
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
    
    // Launch capture browser
    ipcMain.handle('browser:launch-capture', async () => {
        const { exec } = require('child_process');
        const util = require('util');
        const http = require('http');
        const execPromise = util.promisify(exec);
        
        try {
            console.log('[Main] Launching capture browser...');
            
            // First, kill any existing Chrome instances with debugging port
            try {
                if (process.platform === 'darwin') {
                    await execPromise('pkill -f "remote-debugging-port=9222"');
                } else if (process.platform === 'win32') {
                    await execPromise('taskkill /F /IM chrome.exe /FI "COMMANDLINE eq *remote-debugging-port=9222*"').catch(() => {});
                } else {
                    await execPromise('pkill -f "remote-debugging-port=9222"');
                }
                console.log('[Main] Killed existing debug browser');
            } catch (e) {
                // Ignore if no process to kill
                console.log('[Main] No existing debug browser to kill');
            }
            
            // Wait a moment for process to fully terminate
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Launch Chrome with debugging port
            let command;
            const profileDir = process.platform === 'win32' 
                ? path.join(app.getPath('temp'), 'chrome-capture-profile')
                : '/tmp/chrome-capture-profile';
            
            if (process.platform === 'darwin') {
                // macOS - try both Chrome and Chromium
                const chromeApps = [
                    '/Applications/Google Chrome.app',
                    '/Applications/Chromium.app',
                    '~/Applications/Google Chrome.app',
                    '~/Applications/Chromium.app'
                ];
                
                let chromeFound = false;
                for (const appPath of chromeApps) {
                    try {
                        const expandedPath = appPath.replace('~', process.env.HOME);
                        await execPromise(`test -d "${expandedPath}"`);
                        command = `open -na "${expandedPath}" --args --remote-debugging-port=9222 --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --disable-background-timer-throttling`;
                        chromeFound = true;
                        console.log(`[Main] Found Chrome at: ${expandedPath}`);
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                
                if (!chromeFound) {
                    throw new Error('Chrome or Chromium not found. Please install Google Chrome.');
                }
                
            } else if (process.platform === 'win32') {
                // Windows
                command = `start chrome --remote-debugging-port=9222 --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --disable-background-timer-throttling`;
            } else {
                // Linux
                command = `google-chrome --remote-debugging-port=9222 --user-data-dir="${profileDir}" --no-first-run --no-default-browser-check --disable-background-timer-throttling &`;
            }
            
            console.log('[Main] Launching Chrome with command:', command);
            await execPromise(command);
            console.log('[Main] Chrome launch command executed');
            
            // Wait for Chrome to start and verify debugging port is available
            let connected = false;
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if debugging port is open
                const isPortOpen = await new Promise((resolve) => {
                    const req = http.get('http://localhost:9222/json/version', (res) => {
                        resolve(res.statusCode === 200);
                    });
                    req.on('error', () => resolve(false));
                    req.setTimeout(500, () => {
                        req.destroy();
                        resolve(false);
                    });
                });
                
                if (isPortOpen) {
                    console.log('[Main] Chrome debugging port is now open');
                    connected = true;
                    break;
                }
                
                console.log(`[Main] Waiting for Chrome debugging port... attempt ${i + 1}/10`);
            }
            
            if (!connected) {
                throw new Error('Chrome started but debugging port not accessible');
            }
            
            // Notify browser worker to reconnect
            if (browserWorker) {
                console.log('[Main] Notifying browser worker to connect after Chrome launch');
                
                // Send connect message and wait for response
                try {
                    const connectResult = await sendToBrowserWorker('connect');
                    console.log('[Main] Browser worker connect result:', connectResult);
                    
                    // Update UI immediately with connection status
                    if (mainWindow) {
                        mainWindow.webContents.send('browser:status-update', {
                            connected: true,
                            message: 'Enhanced capture ready'
                        });
                    }
                } catch (error) {
                    console.error('[Main] Browser worker connect failed:', error);
                    
                    if (mainWindow) {
                        mainWindow.webContents.send('browser:status-update', {
                            connected: false,
                            message: 'Failed to connect to browser'
                        });
                    }
                }
            } else {
                console.warn('[Main] Browser worker not available to notify about Chrome launch');
            }
            
            return { success: true, message: 'Capture browser launched and connected' };
            
        } catch (error) {
            console.error('[Main] Failed to launch capture browser:', error);
            return { success: false, message: error.message };
        }
    });
    
    // Get browser connection status
    ipcMain.handle('browser:get-status', async () => {
        if (!browserWorker) {
            return { connected: false, message: 'Worker not initialized' };
        }
        
        try {
            const status = await sendToBrowserWorker('status');
            return {
                connected: status.isConnected,
                message: status.isConnected ? 'Enhanced capture active' : 'Not connected'
            };
        } catch (error) {
            return { connected: false, message: error.message };
        }
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
    // Mark app as quitting
    app.isQuitting = true;
    
    // Cleanup browser worker
    if (browserWorker) {
        browserWorker.kill('SIGTERM');
        browserWorker = null;
    }
    
    // Cleanup capture service
    if (captureService) {
        captureService.cleanup();
    }
    
    // Unregister shortcuts
    globalShortcut.unregisterAll();
});

// Will quit
app.on('will-quit', () => {
    // Final cleanup
    if (browserWorker) {
        browserWorker.kill('SIGKILL');
        browserWorker = null;
    }
    
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