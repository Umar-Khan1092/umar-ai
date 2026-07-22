const CACHE_NAME = 'eduerp-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.webp',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Stale-while-revalidate for everything else
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Don't cache API requests or Supabase realtime
        if (
          event.request.url.includes('/api/') || 
          event.request.url.includes('supabase.co') || 
          event.request.method !== 'GET'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // On network failure, if it's a page navigation, return the offline page (or home)
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
      
      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for Push Notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.message || data.body || 'You have a new notification',
        icon: data.icon || '/logo.webp',
        badge: '/favicon.svg',
        vibrate: [200, 100, 200, 100, 200, 100, 200], // Distinctive vibration pattern
        data: {
          url: data.url || '/'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'EduERP Notification', options)
      );
    } catch (e) {
      // Fallback for plain text push
      event.waitUntil(
        self.registration.showNotification('EduERP Notification', {
          body: event.data.text(),
          icon: '/logo.webp',
          vibrate: [200, 100, 200]
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
