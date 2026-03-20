// All-in-One dedicated Service Worker
const CACHE_NAME = 'allinone-v3';

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

    // Stale-while-revalidate: serve from cache instantly, update in background
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

    // API calls - network only
    if (/^\/api\//.test(path)) {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
        return;
    }
});
