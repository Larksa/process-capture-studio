// Test correct uiohook-napi API usage
const uiohook = require('uiohook-napi');

console.log('Available exports:', Object.keys(uiohook));

// The correct way to use uiohook-napi
const { uIOhook } = uiohook;

console.log('uIOhook type:', typeof uIOhook);
console.log('uIOhook methods:', Object.getOwnPropertyNames(uIOhook));

// Test the API
uIOhook.on('keydown', (e) => {
    console.log('Key pressed:', e);
});

uIOhook.on('mouseclick', (e) => {
    console.log('Mouse clicked:', e);
});

console.log('Starting capture...');
uIOhook.start();

setTimeout(() => {
    console.log('Stopping capture...');
    uIOhook.stop();
    process.exit(0);
}, 5000);