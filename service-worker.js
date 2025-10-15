/*
  Clima Agora - Service Worker
  - Pré-cache do App Shell
  - Cache-first para assets estáticos
  - Network-first para API (OpenWeather)
  - Cache-first para fontes e CDNs comuns
*/

const APP_VERSION = 'v1.0.6';
const APP_SHELL = `clima-agora-shell-${APP_VERSION}`;
const RUNTIME_CACHE = `clima-agora-runtime-${APP_VERSION}`;

const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.min.css?v=1.0.7',
  './script.min.js?v=1.0.5',
  './manifest.webmanifest',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

// Lista de candidatos de fundos para pré-cache (tolerante a faltas)
const BG_PRECACHE = [
  'assets/bg/clear.png', 'assets/bg/clear.webp', 'assets/bg/clear.jpg', 'assets/bg/clear.jpeg',
  'assets/bg/clouds.png', 'assets/bg/clouds.webp', 'assets/bg/clouds.jpg', 'assets/bg/clouds.jpeg',
  'assets/bg/rain.png', 'assets/bg/rain.webp', 'assets/bg/rain.jpg', 'assets/bg/rain.jpeg',
  'assets/bg/snow.png', 'assets/bg/snow.webp', 'assets/bg/snow.jpg', 'assets/bg/snow.jpeg',
  'assets/bg/mist.png', 'assets/bg/mist.webp', 'assets/bg/mist.jpg', 'assets/bg/mist.jpeg',
  'assets/bg/thunderstorm.png', 'assets/bg/thunderstorm.webp', 'assets/bg/thunderstorm.jpg', 'assets/bg/thunderstorm.jpeg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL);
    // Pre-cache do shell
    await cache.addAll(APP_SHELL_FILES);
    // Pre-cache tolerante para fundos (ignora erros/404 para arquivos ausentes)
    await Promise.all(
      BG_PRECACHE.map(async (url) => {
        try { await cache.add(url); } catch (_) { /* ignore missing */ }
      })
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Habilita navigation preload quando disponível
      try { if (self.registration.navigationPreload) await self.registration.navigationPreload.enable(); } catch (e) {}
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => {
        if (![APP_SHELL, RUNTIME_CACHE].includes(key)) {
          return caches.delete(key);
        }
      }));
      await self.clients.claim();
    })()
  );
});

// Mensageria para permitir skipWaiting a partir da página
self.addEventListener('message', (event) => {
  if (event && event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Util: identifica domínios
const isOpenWeather = (url) => /api\.openweathermap\.org/.test(url.hostname);
const isCDN = (url) => /fonts\.(googleapis|gstatic)\.com|unpkg\.com/.test(url.hostname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navegação: usa navigation preload, depois rede, com fallback offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
      } catch {}
      try {
        return await fetch(req);
      } catch (e) {
        return caches.match('./index.html');
      }
    })());
    return;
  }

  // API do tempo: network-first com fallback ao cache
  if (isOpenWeather(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // CDNs (fonts/google, unpkg): cache-first
  if (isCDN(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
          return res;
        });
      })
    );
    return;
  }

  // Assets locais: cache-first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
        return res;
      }))
    );
  }
});
