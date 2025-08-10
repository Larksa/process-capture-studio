// Test uiohook-napi API to understand how it works
const uiohook = require('uiohook-napi');

console.log('uiohook-napi loaded:', typeof uiohook);
console.log('Available methods:', Object.keys(uiohook));
console.log('uiohook.UiohookKey:', typeof uiohook.UiohookKey);

// Check if it's a class that needs to be instantiated
if (uiohook.UiohookKey) {
    const ioHook = new (uiohook.UiohookKey || uiohook)();
    console.log('Instantiated:', typeof ioHook);
    console.log('Instance methods:', Object.keys(ioHook));
} else {
    console.log('Direct usage properties:', Object.getOwnPropertyNames(uiohook));
}