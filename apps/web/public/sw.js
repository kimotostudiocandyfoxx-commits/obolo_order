/* Obolo Order service worker: Web Push only (incoming calls, mail). No offline caching. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let p = {};
  try {
    p = e.data ? e.data.json() : {};
  } catch {
    p = { title: 'Obolo Order', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(p.title || 'Obolo Order', {
      body: p.body || '',
      tag: p.tag,
      renotify: !!p.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: p.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
