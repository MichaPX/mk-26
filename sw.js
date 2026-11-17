/* Magazin-Kiosk · Service Worker
   - App-Dateien: erst Netz, sonst Zwischenspeicher (App startet auch offline)
   - Katalog aus Supabase: erst Netz, sonst letzter Stand
   - Seitenbilder, Cover, Logos: aus dem Zwischenspeicher, im Hintergrund aktualisiert
     → bereits angesehene Hefte sind offline lesbar */
var VERSION = 'kiosk-v1';
var SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('kiosk-') === 0 && k !== VERSION && k !== 'kiosk-media'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req, cacheName) {
  return fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(cacheName).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () { return caches.match(req); });
}
function cacheFirst(req) {
  return caches.open('kiosk-media').then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/storage/v1/object/public/') >= 0 && url.pathname.indexOf('/texts/') < 0) { e.respondWith(cacheFirst(req)); return; }
  if (url.pathname.indexOf('/rest/v1/') >= 0 || url.pathname.indexOf('/texts/') >= 0) { e.respondWith(networkFirst(req, 'kiosk-data')); return; }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('admin.html')) return;
    e.respondWith(networkFirst(req, VERSION));
  }
});
