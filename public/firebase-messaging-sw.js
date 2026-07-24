importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBGGedpU0hK3PJlhRXjADNzlEIBfbWAyf4",
  authDomain: "edu-erp-system.firebaseapp.com",
  projectId: "edu-erp-system",
  storageBucket: "edu-erp-system.firebasestorage.app",
  messagingSenderId: "982357177062",
  appId: "1:982357177062:web:51cfb381e4435aff1d0127"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Extract info from payload (either notification or data block depending on backend send format)
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Edu ERP';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [300, 110, 300, 110, 300, 110, 500],
    data: {
      url: payload.data?.url || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle clicking on the notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
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
