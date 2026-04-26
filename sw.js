const CACHE_NAME = 'investpro-v1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './main.js',
    './calculs.js',
    './ui.js',
    './pdf.js',
    './styles.css',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
];

// Installation : mise en cache des assets locaux
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Assets locaux (même origine) : requête normale
            const localAssets = STATIC_ASSETS.filter(url => !url.startsWith('http'));
            // Assets CDN (cross-origin) : mode no-cors pour les réponses opaques
            const cdnAssets = STATIC_ASSETS.filter(url => url.startsWith('http'));

            return Promise.all([
                cache.addAll(localAssets),
                ...cdnAssets.map(url =>
                    fetch(new Request(url, { mode: 'no-cors' }))
                        .then(response => cache.put(url, response))
                        .catch(() => { /* CDN indisponible au premier chargement, ignoré */ })
                ),
            ]);
        }).then(() => self.skipWaiting())
    );
});

// Activation : supprime les anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

// Fetch : Network-First pour index.html, Cache-First pour tout le reste
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ne pas intercepter les requêtes non-GET
    if (event.request.method !== 'GET') return;

    // Network-First pour index.html (évite de servir un HTML obsolète)
    if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Cache-First pour tous les autres assets (JS, CSS, images, CDN)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => new Response('Ressource non disponible hors-ligne', { status: 503, statusText: 'Service Unavailable' }));
        })
    );
});
