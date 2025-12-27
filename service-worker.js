// Name your cache
const CACHE_NAME = "ecosystem-pwa-v1";

// Files you want cached for offline use
const OFFLINE_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/collar-192.png",
  "/icons/collar-512.png"
];

// Install event
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", event => {
  const req = event.request;

  // Don't try to cache cross-origin iframe content (qkarin.com)
  if (!req.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      return (
        cached ||
        fetch(req).catch(() => {
          if (req.mode === "navigate") {
            return caches.match("/");
          }
        })
      );
    })
  );
});

// Push event
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title || "Notification", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.url || "/"
    })
  );
});

// Notification click
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});