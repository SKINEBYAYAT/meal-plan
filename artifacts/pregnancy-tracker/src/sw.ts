/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference lib="webworker.iterable" />

// vite-plugin-pwa injects the precache manifest at build time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

// IMPORTANT: bump this version whenever cached content must be force-refreshed.
// The activate handler deletes all caches that don't match this name.
const CACHE_NAME = 'pnt-v2';

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

// ─── Fetch: NETWORK-FIRST with cache fallback ────────────────────────────────
// Always try the network so users get the latest app immediately after a
// deploy. The cache is only used when offline. (The previous cache-first
// strategy served stale builds forever — never reintroduce it for HTML/JS.)

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Only handle same-origin requests; let the browser handle everything else
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Offline — serve from cache; for navigations fall back to app shell
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});

self.addEventListener('push', (event) => {
  const payload = event.data?.json() as { title?: string; body?: string; mealId?: string } | undefined;
  event.waitUntil(self.registration.showNotification(payload?.title ?? 'Meal Plan Reminder', {
    body: payload?.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { mealId: payload?.mealId },
  }));
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
