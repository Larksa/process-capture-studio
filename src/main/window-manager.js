/**
 * Window Manager - Handles window positioning, opacity, and display management
 */

const { screen } = require('electron');

class WindowManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.isAlwaysOnTop = false;
        this.currentOpacity = 1.0;
        this.savedBounds = null;
    }

    /**
     * Set always on top
     */
    setAlwaysOnTop(enabled) {
        this.isAlwaysOnTop = enabled;
        this.mainWindow.setAlwaysOnTop(enabled);
        
        // Adjust opacity for always on top mode
        if (enabled) {
            this.setOpacity(0.95);
        } else {
            this.setOpacity(1.0);
        }
    }

    /**
     * Set window opacity
     */
    setOpacity(opacity) {
        this.currentOpacity = Math.max(0.3, Math.min(1.0, opacity));
        this.mainWindow.setOpacity(this.currentOpacity);
    }

    /**
     * Position window in corner
     */
    positionInCorner(corner = 'top-right') {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const bounds = this.mainWindow.getBounds();
        
        const positions = {
            'top-left': { x: 0, y: 0 },
            'top-right': { x: width - bounds.width, y: 0 },
            'bottom-left': { x: 0, y: height - bounds.height },
            'bottom-right': { x: width - bounds.width, y: height - bounds.height }
        };
        
        const pos = positions[corner] || positions['top-right'];
        this.mainWindow.setPosition(pos.x, pos.y);
    }

    /**
     * Toggle compact mode
     */
    toggleCompactMode() {
        const currentBounds = this.mainWindow.getBounds();
        
        if (this.savedBounds) {
            // Restore normal size
            this.mainWindow.setBounds(this.savedBounds);
            this.savedBounds = null;
        } else {
            // Save current and switch to compact
            this.savedBounds = currentBounds;
            this.mainWindow.setBounds({
                x: currentBounds.x,
                y: currentBounds.y,
                width: 400,
                height: 600
            });
        }
    }

    /**
     * Center window on screen
     */
    centerWindow() {
        this.mainWindow.center();
    }

    /**
     * Get current display
     */
    getCurrentDisplay() {
        const bounds = this.mainWindow.getBounds();
        return screen.getDisplayMatching(bounds);
    }

    /**
     * Move to display
     */
    moveToDisplay(displayId) {
        const displays = screen.getAllDisplays();
        const targetDisplay = displays.find(d => d.id === displayId);
        
        if (targetDisplay) {
            const bounds = this.mainWindow.getBounds();
            this.mainWindow.setBounds({
                x: targetDisplay.bounds.x + 50,
                y: targetDisplay.bounds.y + 50,
                width: bounds.width,
                height: bounds.height
            });
        }
    }

    /**
     * Save window state
     */
    saveWindowState() {
        const bounds = this.mainWindow.getBounds();
        const state = {
            bounds: bounds,
            isMaximized: this.mainWindow.isMaximized(),
            isFullScreen: this.mainWindow.isFullScreen(),
            isAlwaysOnTop: this.isAlwaysOnTop,
            opacity: this.currentOpacity
        };
        
        return state;
    }

    /**
     * Restore window state
     */
    restoreWindowState(state) {
        if (!state) return;
        
        if (state.bounds) {
            this.mainWindow.setBounds(state.bounds);
        }
        
        if (state.isMaximized) {
            this.mainWindow.maximize();
        }
        
        if (state.isFullScreen) {
            this.mainWindow.setFullScreen(true);
        }
        
        if (state.isAlwaysOnTop) {
            this.setAlwaysOnTop(true);
        }
        
        if (state.opacity) {
            this.setOpacity(state.opacity);
        }
    }
}

module.exports = WindowManager;