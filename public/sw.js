const CACHE_NAME = 'chatly-cache-v1';

// Install event
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Fetch event (Bypass for Firebase/Cloudinary real-time, just pass through)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response("Network offline")));
});