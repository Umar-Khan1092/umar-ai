const CACHE_NAME = 'eduerp-v10';
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
          !event.request.url.startsWith('http') ||
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
  console.log('[Service Worker] Push event received.');
  
  if (!event.data) {
    console.log('[Service Worker] Push event received but had no data.');
    return;
  }

  const pushPromise = Promise.resolve().then(async () => {
    let data;
    try {
      data = event.data.json();
      console.log('[Service Worker] Parsed push payload JSON:', data);
    } catch (e) {
      console.warn('[Service Worker] Push payload is not JSON. Falling back to plain text:', e);
      const text = event.data.text();
      console.log('[Service Worker] Raw text:', text);
      return self.registration.showNotification('EduERP Notification', {
        body: text,
        icon: '/logo.webp',
        vibrate: [300, 110, 300, 110, 300, 110, 500],
        silent: false
      });
    }

    // Set app badge count
    try {
      if (data.unreadCount !== undefined && 'setAppBadge' in navigator) {
        console.log('[Service Worker] Setting app badge to:', data.unreadCount);
        await navigator.setAppBadge(data.unreadCount).catch((err) => {
          console.error('[Service Worker] Failed to set app badge:', err);
        });
      }
    } catch (e) {
      console.error('[Service Worker] Badge error:', e);
    }

    const tag = data.tag || data.category || 'general';
    const options = {
      body: data.message || data.body || 'You have a new notification',
      icon: data.icon || '/logo.webp',
      vibrate: [300, 110, 300, 110, 300, 110, 500], // Stronger default vibration pattern
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
    
    const title = data.title ? data.title : 'EduERP Notification';
    console.log('[Service Worker] Displaying notification:', title, options);

    // Broadcast to active windows
    try {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      console.log('[Service Worker] Active window clients found:', clientsList.length);
      for (const client of clientsList) {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          payload: data
        });
      }
    } catch (e) {
      console.error('[Service Worker] Client broadcast error:', e);
    }

    try {
      await self.registration.showNotification(title, options);
      console.log('[Service Worker] showNotification completed successfully.');
    } catch (err) {
      console.error('[Service Worker] Failed to show notification:', err);
    }
  });

  event.waitUntil(pushPromise);
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
