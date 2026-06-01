/**
 * 吉力咖啡烘焙生管系統 — Service Worker
 * =========================================
 * 策略：Cache First（離線優先）
 * 資料操作透過 GAS fetch，網路失敗時 UI 仍可操作（依 localStorage）
 */

const CACHE_NAME = 'jili-v1';
const STATIC_ASSETS = [
  './',
  './jili-manager.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600&family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap',
];

// ── Install：預快取靜態資源 ──────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] 部分資源快取失敗（可能是 CORS）:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate：清除舊快取 ─────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch：Cache First，GAS 請求直接 Network ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GAS 請求不快取，直接網路
  if (url.hostname === 'script.google.com') {
    e.respondWith(fetch(e.request).catch(() => new Response('{"ok":false,"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Google Fonts — Network First（有快取則用）
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 其他靜態資源：Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
