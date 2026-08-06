/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference lib="webworker.iterable" />

// vite-plugin-pwa injects the precache manifest at build time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

const CACHE_NAME = 'pnt-v1';

// ─── Precache ────────────────────────────────────────────────────────────────

interface ManifestEntry { url: string; revision: string | null }
const precacheEntries: ManifestEntry[] = self.__WB_MANIFEST;
const precacheUrls: string[] = precacheEntries.map((e) => e.url);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(precacheUrls))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch: cache-first for precached assets ─────────────────────────────────

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});

// ─── Notification click → open / focus app, deep-link to meal ────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data as { mealId?: string } | undefined;
  const mealId = data?.mealId;
  const scope = self.registration.scope;
  const targetUrl = mealId
    ? `${scope}meals?highlight=${encodeURIComponent(mealId)}`
    : `${scope}meals`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', mealId });
            return (client as WindowClient).focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

self.addEventListener('notificationclose', (_event) => {
  // reserved for future analytics
});
