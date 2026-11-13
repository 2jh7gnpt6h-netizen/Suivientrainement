/* Service worker : rend l'app utilisable hors ligne (salle sans réseau).
   - Page et fichiers de l'app : réseau d'abord, copie en cache en secours.
   - Bibliothèques et polices (CDN) : cache d'abord.
   - Dropbox n'est jamais intercepté ni mis en cache : les données restent
     uniquement dans le stockage de la page sur l'appareil. */
var VERSION = "suivi-v3";
var SHELL = ["./", "index.html", "dropbox-sync.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];
var CDN = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && !url.search) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match("index.html"); });
    }));
  } else if (CDN.indexOf(url.hostname) !== -1) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok || res.type === "opaque") { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
