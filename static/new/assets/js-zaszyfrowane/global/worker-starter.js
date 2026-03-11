(function () {
    if (!('serviceWorker' in navigator)) return;
    const SW_URL = '/service-worker.js';
    var reloading = false;
    function registerSW() {
        navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' }).then(reg => {
            console.log('[SW] registered:', reg.scope);
            if (reg.installing) trackInstalling(reg.installing);
            reg.addEventListener('updatefound', () => {
                if (reg.installing) trackInstalling(reg.installing);
            });
            // Force update check on every page load
            reg.update().catch(() => {});
        }).catch(err => {
            console.warn('[SW] register error:', err);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloading) return;
            reloading = true;
            console.log('[SW] controller changed → reload');
            window.location.reload();
        });

        navigator.serviceWorker.addEventListener('message', (e) => {
            var d = e.data || {};
            if (d.type === 'REQUEST_SOURCE') {
                console.log('[SW] ' + d.source + ': ' + d.url);
            }
            if (d.type === 'CACHE_CLEARED') {
                console.log('[SW] cache cleared by admin');
                window.location.reload();
            }
        });
    }

    function trackInstalling(worker) {
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                // Auto-activate new SW without asking user
                worker.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    window.addEventListener('load', registerSW);
})();
