const CACHE_NAME = 'mobywatel-v7';
const APP_LOGIN_URL = '/login?pwa=1&next=%2Fdocuments';
const HTML_ROUTE_PATTERN = /^\/(documents|services|more|qr_code|login)(\/|$)/;

// Core assets to precache on install — everything needed for instant PWA load
const PRECACHE_ASSETS = [
    // HTML pages (shell)
    APP_LOGIN_URL,
    '/login',
    '/documents',
    '/services',
    '/more',
    '/qr_code',
    // CSS
    '/assets/css/style.css',
    // JS — global
    '/assets/js/global/jquery.js',
    '/assets/js/global/qrcode.js',
    '/assets/js/global/utilities.js',
    '/assets/js/global/worker-starter.js',
    '/assets/js/global/enhancements.js',
    // JS — pages
    '/assets/js/script.js',
    '/assets/js/pages/index.js',
    '/assets/js/pages/login.js',
    '/assets/js/pages/documents.js',
    '/assets/js/pages/qr_code.js',
    '/assets/js/pages/services.js',
    '/assets/js/pages/more.js',
    // JS — document subpages
    '/assets/js/pages/documents/mdowod.js',
    '/assets/js/pages/documents/mprawojazdy.js',
    '/assets/js/pages/documents/school_id.js',
    '/assets/js/pages/documents/student_id.js',
    // SVG — logo & navigation
    '/assets/svg/logo.svg',
    '/assets/svg/navigation/light/documents.svg',
    '/assets/svg/navigation/light/documents_active.svg',
    '/assets/svg/navigation/light/services.svg',
    '/assets/svg/navigation/light/services_active.svg',
    '/assets/svg/navigation/light/qr_code.svg',
    '/assets/svg/navigation/light/qr_code_active.svg',
    '/assets/svg/navigation/light/more.svg',
    '/assets/svg/navigation/light/more_active.svg',
    // SVG — documents page
    '/assets/svg/documents/ai.svg',
    '/assets/svg/documents/notifications.svg',
    // SVG — login page
    '/assets/svg/login/kpo.svg',
    '/assets/svg/login/rp.svg',
    '/assets/svg/login/eu.svg',
    '/assets/svg/login/mc.svg',
    '/assets/svg/login/password.svg',
    // SVG — QR code page
    '/assets/svg/qr_code/show.svg',
    '/assets/svg/qr_code/scan.svg',
    '/assets/svg/qr_code/sign.svg',
    // Images — core
    '/assets/img/logo.png',
    '/assets/img/apple-180x.png',
    '/assets/img/card_eagle.png',
    '/assets/img/card_stars.png',
    '/assets/img/godlo.png',
    '/assets/img/godlo.gif',
    '/assets/img/godlo_mask.png',
    '/assets/img/flaga.gif',
    '/assets/img/bg_light.png',
    '/assets/img/mdowod_card.png',
    '/assets/img/id_details.png',
    // Images — document cards
    '/assets/img/cards/documents/mdowod.png',
    '/assets/img/cards/documents/mprawojazdy.png',
    '/assets/img/cards/documents/school_id.png',
    '/assets/img/cards/documents/student_id.png',
    // Fonts (woff2)
    '/assets/css/icons/fonts/fa-regular-400.woff2',
    '/assets/css/icons/fonts/fa-solid-900.woff2',
    '/assets/css/icons/fonts/fa-thin-100.woff2',
    // Manifest
    '/manifest.json'
];

function getHtmlCacheKey(pathname) {
    return new Request(pathname, { credentials: 'same-origin' });
}

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Use individual add() calls — don't fail all if one 404s
            return Promise.allSettled(
                PRECACHE_ASSETS.map(url => cache.add(url).catch(() => {
                    console.warn('[SW] precache skip:', url);
                }))
            );
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
    if (e.data && e.data.type === 'INVALIDATE' && Array.isArray(e.data.urls)) {
        caches.open(CACHE_NAME).then(cache => {
            e.data.urls.forEach(url => {
                cache.delete(new Request(url)).catch(() => {});
            });
        });
    }
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Only handle same-origin GET requests
    if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

    const path = url.pathname;

    // Always fetch live UI scripts from network (never cache)
    if (
        path === '/assets/js/global/notifications-bell.js' ||
        path === '/assets/js/global/chat-feed.js'
    ) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Chat API must never return stale data from cache
    if (/^\/api\/chat\//.test(path)) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Cache-first for static assets (css, js, svg, img, fonts, json)
    if (/^\/(assets|manifest\.json)/.test(path)) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Stale-while-revalidate for HTML pages — instant from cache, update in background
    if (HTML_ROUTE_PATTERN.test(path)) {
        const cacheKey = getHtmlCacheKey(path);
        e.respondWith(
            caches.match(cacheKey).then(cached => {
                const fetchPromise = fetch(e.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(cacheKey, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || fetchPromise;
            })
        );
        return;
    }

    // Network-first for user documents — cache result for offline use
    if (/^\/user_files\//.test(path)) {
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

    // Network-first for API and dynamic content
    if (/^\/(api|my-document)/.test(path)) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
    }
});
