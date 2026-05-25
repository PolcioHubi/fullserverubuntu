// Extracted from inline <script> in static/new/login.html for CSP compliance.
// Initializes loginManager (defined in pages/login.js) on DOM ready.
$(function () {
    if (typeof loginManager !== 'undefined' && loginManager && typeof loginManager.init === 'function') {
        loginManager.init();
    }
});
