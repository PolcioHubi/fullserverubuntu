const CACHE_NAME = 'mobywatel-cache-v6';
const urlsToCache = [
  '/static/logowanie.html',
  '/static/dashboard.html',
  '/static/documents.html',
  '/static/services.html',
  '/static/more.html',
  '/static/qr.html',
  '/static/pokaz_qr.html',
  '/static/skanuj_qr.html',
  '/static/main.css',
  '/static/qr.css',
  '/static/qr2.css',
  '/static/jquery-3.6.0.min.js',
  '/static/manifest.json',
  '/static/apple.png',
  '/static/coi_common_ui_ic_mobywatel_logo.svg'
];

// Wzorce URL dla dynamicznych danych (Network First)
const DYNAMIC_PATTERNS = [
  '/user_files/',
  '/user_data/',
  'dowodnowy.html',
  '/api/',
  '/profile',
  '/admin/'
];

// Sprawdza czy URL jest dynamiczny
function isDynamicRequest(url) {
  return DYNAMIC_PATTERNS.some(pattern => url.includes(pattern));
}

// Instalacja Service Workera
self.addEventListener('install', event => {
  // Wymusza natychmiastową aktywację nowego SW
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktywacja Service Workera i czyszczenie starych cache
self.addEventListener('activate', event => {
  // Przejmij kontrolę nad wszystkimi klientami natychmiast
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Przechwytywanie żądań sieciowych
self.addEventListener('fetch', event => {
  // Obsługujemy tylko żądania GET i ignorujemy żądania chrome-extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  const requestUrl = event.request.url;
  const requestOrigin = new URL(requestUrl).origin;

  // Nie przechwytujemy zasobów z innych domen (np. CDN).
  // Dzięki temu request idzie normalnie przez przeglądarkę i nie wpada pod CSP connect-src w SW.
  if (requestOrigin !== self.location.origin) {
    return;
  }

  const acceptHeader = event.request.headers.get('accept') || '';
  const isDocumentRequest =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    acceptHeader.includes('text/html');

  // HTML (np. /, /profile, /login) zawsze pobieramy z sieci.
  // Dzięki temu po imporcie bazy nie zostaje stary widok użytkownika/statystyk.
  if (isDocumentRequest) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then(cachedResponse => cachedResponse || Response.error());
      })
    );
    return;
  }

  // NETWORK FIRST dla dynamicznych danych (zdjęcia użytkowników, dokumenty, API)
  if (isDynamicRequest(requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Opcjonalnie: zapisz w cache jako fallback offline
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback do cache gdy offline
          return caches.match(event.request).then(cachedResponse => cachedResponse || Response.error());
        })
    );
    return;
  }

  // CACHE FIRST dla statycznych zasobów (CSS, JS, fonty)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(() => {
          return caches.match(event.request).then(cachedResponse => cachedResponse || Response.error());
        });
      })
  );
});
