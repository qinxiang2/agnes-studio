// Agnes AI Studio - Service Worker
const CACHE_NAME = 'agnes-studio-v26';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for Agnes API calls
  if (url.hostname === 'apihub.agnes-ai.com') {
    return; // Don't intercept API calls
  }

  // Network-only for CORS proxy
  if (url.pathname.includes('proxy')) {
    return;
  }

  // Network-only for Replicate API
  if (url.hostname === 'api.replicate.com') {
    return;
  }

  // Network-only for Atlas Cloud API
  if (url.hostname === 'api.atlascloud.ai') {
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return cached || new Response(
            '<html><body style="background:#0f0f1a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;font-family:sans-serif;height:100vh;margin:0"><div style="text-align:center"><h1>📡</h1><p>请连接网络后使用</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});
