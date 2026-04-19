try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch(e) {}

const APP_CACHE = 'qk-app-v7';
const MEDIA_CACHE = 'qk-media-v1';
const SHELL = ['/icons/collar-192.png', '/icons/collar-512.png'];
const MEDIA_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|avif|bmp|mp4|webm|mov|m4v)(\?|$)/i;
const MAX_MEDIA_ENTRIES = 120;

function isCacheableResponse(response) {
    return !!response && (response.ok || response.type === 'opaque');
}

function isMediaRequest(request) {
    if (request.method !== 'GET') return false;
    if (request.headers.has('range')) return false;

    const url = new URL(request.url);
    if (request.destination === 'image' || request.destination === 'video') return true;
    return MEDIA_EXTENSIONS.test(url.pathname) || MEDIA_EXTENSIONS.test(url.href);
}

async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const overflow = keys.length - maxEntries;

    if (overflow <= 0) return;

    await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function handleMediaRequest(request) {
    const cache = await caches.open(MEDIA_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
        await trimCache(MEDIA_CACHE, MAX_MEDIA_ENTRIES);
    }

    return response;
}

self.addEventListener('install', e => {
    e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(k => k.startsWith('qk-') && k !== APP_CACHE && k !== MEDIA_CACHE)
                .map(k => caches.delete(k))
        ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    if (isMediaRequest(e.request)) {
        e.respondWith(
            handleMediaRequest(e.request).catch(() => caches.match(e.request).then(r => r || Response.error()))
        );
        return;
    }

    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;

    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
