#!/usr/bin/env node

/**
 * Test script for terminal feed functionality
 * Run this after starting the app to see sample data in terminal format
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Sample test activities that would come from capture service
const testActivities = [
    {
        type: 'click',
        timestamp: Date.now(),
        position: { x: 453, y: 234 },
        application: 'Chrome',
        context: {
            app: 'Chrome',
            url: 'https://www.example.com/search'
        },
        element: {
            tagName: 'BUTTON',
            id: 'search-btn',
            text: 'Search',
            selector: '#search-btn',
            xpath: '//*[@id="search-btn"]'
        },
        description: 'Clicked search button'
    },
    {
        type: 'keystroke',
        timestamp: Date.now() + 1000,
        keys: 'John Smith',
        application: 'Chrome',
        element: {
            tagName: 'INPUT',
            id: 'customer-name',
            attributes: {
                placeholder: 'Enter customer name'
            }
        },
        description: 'Typed customer name'
    },
    {
        type: 'keystroke',
        timestamp: Date.now() + 2000,
        key: 'Enter',
        application: 'Chrome',
        description: 'Pressed Enter'
    },
    {
        type: 'navigation',
        timestamp: Date.now() + 3000,
        url: 'https://www.example.com/results?q=John+Smith',
        from: 'https://www.example.com/search',
        application: 'Chrome'
    },
    {
        type: 'marked-action',
        timestamp: Date.now() + 4000,
        description: 'Search for customer',
        duration: 3500,
        data: {
            description: 'Search for customer',
            duration: 3500,
            events: [
                {
                    type: 'click',
                    timestamp: Date.now(),
                    coordinates: { x: 453, y: 234 },
                    element: { selector: '#search-btn' }
                },
                {
                    type: 'keystroke',
                    timestamp: Date.now() + 1000,
                    keys: 'John Smith'
                },
                {
                    type: 'key',
                    timestamp: Date.now() + 2000,
                    key: 'Enter'
                }
            ]
        }
    },
    {
        type: 'browser-context',
        timestamp: Date.now() + 5000,
        status: 'Connected',
        url: 'https://www.example.com/customer/12345'
    }
];

// Send test activities to renderer
function sendTestActivities(mainWindow) {
    console.log('Sending test activities to renderer...');
    
    let index = 0;
    const interval = setInterval(() => {
        if (index < testActivities.length) {
            const activity = testActivities[index];
            console.log(`Sending test activity ${index + 1}:`, activity.type);
            mainWindow.webContents.send('capture:activity', activity);
            index++;
        } else {
            clearInterval(interval);
            console.log('All test activities sent!');
        }
    }, 1500); // Send one every 1.5 seconds
}

// If running standalone
if (require.main === module) {
    console.log('Test Terminal Feed - Standalone Mode');
    console.log('Please start the main app first, then run this test');
    console.log('\nSample terminal output format:');
    console.log('[10:23:15.123] 🖱️ CLICK at (453, 234) in Chrome');
    console.log('               URL: https://www.example.com/search');
    console.log('               Element: <button>Search</button>');
    console.log('               Selector: #search-btn');
    console.log('[10:23:18.456] ⌨️ TYPE "John Smith" in Chrome');
    console.log('               Target: <input#customer-name> Enter customer name');
    console.log('[10:23:20.789] ⌧ KEY Enter in Chrome');
    console.log('[10:23:21.012] 🔄 NAVIGATE to https://www.example.com/results?q=John+Smith');
    console.log('[10:23:25.345] 🎯 MARKED ACTION: "Search for customer"');
    console.log('               └─ 3 events captured in 3.5s');
}

module.exports = { sendTestActivities, testActivities };