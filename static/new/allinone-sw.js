// All-in-One dedicated Service Worker
const CACHE_NAME = 'allinone-v7';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

    const path = url.pathname;

    // /user_files/*.html — recompiled per click, must never come from cache.
    // Otherwise users see stale JS handlers after recompile (regression observed
    // 2026-05). Network-first with cache as offline fallback only.
    if (/^\/user_files\/.*\.html$/.test(path)) {
        e.respondWith(
            fetch(e.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return response;
            }).catch(() => caches.match(e.request))
        );
        return;
    }

    // Other /user_files/* and /assets/* assets — stale-while-revalidate.
    // Big static blobs (images, fonts) don't need fresh-every-time.
    if (/^\/user_files\//.test(path) || /^\/(assets|allinone-manifest\.json)/.test(path)) {
        e.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(e.request).then(cached => {
                    const fetchPromise = fetch(e.request).then(response => {
                        if (response.ok) {
                            cache.put(e.request, response.clone());
                        }
                        return response;
                    }).catch(() => cached);

                    // Return cached immediately, or wait for network on first visit
                    return cached || fetchPromise;
                })
            )
        );
        return;
    }

    // API calls — network only. If the network truly fails, return a JSON
    // error so the page can react gracefully (previously returned undefined,
    // which surfaced as net::ERR_FAILED in DevTools and broke the bell badge).
    if (/^\/api\//.test(path)) {
        e.respondWith(
            fetch(e.request).catch(() =>
                new Response(JSON.stringify({ success: false, offline: true }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }
});
