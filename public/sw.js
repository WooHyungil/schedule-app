const CACHE_NAME = "schedule-app-cache-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDvq3XNvneLJchFBBQTpLZLFvQJe3vU3vc',
  authDomain: 'schedule-app-46575.firebaseapp.com',
  projectId: 'schedule-app-46575',
  storageBucket: 'schedule-app-46575.appspot.com',
  messagingSenderId: '1070524189819',
  appId: '1:1070524189819:web:9d4f2f3b8a8f7c6d5e4',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || '일정 알림';
  const options = {
    body: payload?.notification?.body || '새 알림이 도착했습니다.',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
