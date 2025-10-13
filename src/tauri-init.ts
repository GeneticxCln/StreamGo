// Tauri API Initialization
// This must be loaded before main application
(function() {
    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        window.__TAURI__ = { invoke: window.__TAURI_INTERNALS__.invoke };
    } else {
        console.error('Tauri API not available');
    }
})();
