(function () {
    if (!('serviceWorker' in navigator)) return;
    const SW_URL = '/service-worker.js';
    function registerSW() {
        navigator.serviceWorker.register(SW_URL, { scope: '/' }).then(reg => {
            console.log('[SW] registered:', reg.scope);
            if (reg.installing) trackInstalling(reg.installing, reg);
            reg.addEventListener('updatefound', () => {
                if (reg.installing) trackInstalling(reg.installing, reg);
            });
        }).catch(err => {
            console.warn('[SW] register error:', err);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] controller changed → reload');
            window.location.reload();
        });

        navigator.serviceWorker.addEventListener('message', (e) => {
            const d = e.data || {};
            if (d.type === 'REQUEST_SOURCE') {
                console.log(`[SW] ${d.source}: ${d.url}`);
            }
            if (d.type === 'NEW_VERSION_AVAILABLE') {
                const ok = confirm('Dostępna jest nowa wersja aplikacji. Zainstalować teraz?');
                if (ok && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                }
            }
        });
    }

    function trackInstalling(worker, reg) {
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then(() => {
                        window.postMessage({ type: 'sw-update-ready' }, window.location.origin);
                        navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_READY' });
                    });
                } else {
                    console.log('[SW] first install complete');
                }
            }
        });
    }

    window.addEventListener('load', registerSW);
})();
