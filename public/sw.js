const CACHE_NAME = 'eduerp-v6';
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
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
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
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
      
      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for Push Notifications - Native WhatsApp-like behavior
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      
      try {
        if (data.unreadCount !== undefined && 'setAppBadge' in navigator) {
          event.waitUntil(navigator.setAppBadge(data.unreadCount).catch(() => {}));
        }
      } catch (e) {
        console.error('Badge error:', e);
      }

      // Grouping tag, defaults to 'general' if not provided
      const tag = data.tag || data.category || 'general';

      const options = {
        body: data.message || data.body || 'You have a new notification',
        icon: data.icon || '/logo.webp',
        vibrate: [200, 100, 200, 100, 200], // Distinctive vibration pattern
        silent: false, // Ensure it makes a sound/vibrates
        tag: tag,
        renotify: true, // Vibrate/alert even if a notification with this tag already exists
        requireInteraction: false, // Don't force them to dismiss it manually, let it sit in tray
        data: {
          url: data.url || '/',
          unreadCount: data.unreadCount
        },
        actions: [
          { action: 'view', title: 'View Details' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      };
      
      const title = data.title ? `EduERP: ${data.title}` : 'EduERP Notification';
      
      // Notify active PWA windows to update UI instantly without refresh (Real-time syncing)
      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
          for (const client of clientsList) {
            client.postMessage({
              type: 'PUSH_RECEIVED',
              payload: data
            });
          }
          return self.registration.showNotification(title, options);
        })
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
  const clickedNotification = event.notification;
  clickedNotification.close();

  // If user clicked 'dismiss' action, just close it and do nothing else
  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = (clickedNotification.data && clickedNotification.data.url) ? clickedNotification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Clear badge when notifications are closed by the user manually
self.addEventListener('notificationclose', (event) => {
  // Optional: We can decrease the badge here, or leave it to the app frontend to manage on read
});
