// Offline support: serve the page from cache when the network is slow or
// absent. list.json and the GitHub API are never cached here (the page
// keeps the last list in localStorage itself).
var CACHE = "mp-shell-v3";
var SHELL = ["./", "./index.html", "./manifest.webmanifest",
             "./apple-touch-icon.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                           .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.slice(-10) === "/list.json") return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var net = fetch(e.request).then(function (resp) {
      if (resp.ok) cache.put(e.request, resp.clone());
      return resp;
    });
    return cache.match(e.request, { ignoreSearch: true }).then(function (cached) {
      if (!cached) return net;
      net.catch(function () {});
      // Network first, but don't keep the user waiting in a shop with bad reception.
      var slow = new Promise(function (_, reject) { setTimeout(reject, 2500); });
      return Promise.race([net, slow]).catch(function () { return cached; });
    });
  }));
});
