// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  GLOBALNE WYMUSZONE ODŚWIEŻENIE APLIKACJI                             ║
// ║                                                                       ║
// ║  Jak wypchnąć nowy JS/HTML/CSS do WSZYSTKICH użytkowników:            ║
// ║  → zmień APP_VERSION poniżej na nową wartość (np. zwiększ datę).      ║
// ║                                                                       ║
// ║  Co się stanie:                                                       ║
// ║  1. Browser pobiera ten plik świeży (no-store w app.py).              ║
// ║  2. Klient porównuje zapisaną wersję z APP_VERSION.                   ║
// ║  3. Różnica → unregister service worker, czyszczenie wszystkich       ║
// ║     cache'y (Cache Storage + HTTP), pełny reload z bypassem.          ║
// ║  4. Po reload klient widzi nową wersję, zapisuje ją lokalnie.         ║
// ╚═══════════════════════════════════════════════════════════════════════╝
const APP_VERSION = '2026-05-17.3';

(function () {
    'use strict';
    const STORAGE_KEY = 'mobywatel_app_version';
    let reloading = false;

    async function purgeEverythingAndReload() {
        if (reloading) return;
        reloading = true;
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister().catch(() => {})));
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
            }
        } catch (e) {
            console.warn('[AppVersion] purge error (continuing):', e);
        }
        try { localStorage.setItem(STORAGE_KEY, APP_VERSION); } catch (e) {}
        // Bust HTTP cache for subsequent fetches by appending version param,
        // then do a full reload that re-resolves all resources.
        const sep = location.search ? '&' : '?';
        const target = location.pathname + location.search + sep + '_v=' + encodeURIComponent(APP_VERSION) + location.hash;
        location.replace(target);
    }

    function checkVersionThen(callback) {
        let stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
        if (stored && stored !== APP_VERSION) {
            console.log('[AppVersion] mismatch:', stored, '→', APP_VERSION, '— purging caches & reloading');
            purgeEverythingAndReload();
            return;
        }
        if (!stored) {
            try { localStorage.setItem(STORAGE_KEY, APP_VERSION); } catch (e) {}
        }
        callback();
    }

    function registerSW() {
        if (!('serviceWorker' in navigator)) return;
        const SW_URL = '/service-worker.js';
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
            const d = e.data || {};
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

    window.addEventListener('load', () => {
        checkVersionThen(registerSW);
    });

    // Re-check version when tab regains focus — catches users with long-lived tabs
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !reloading) {
            checkVersionThen(() => {});
        }
    });
})();
