// Guarda la app para que funcione sin internet.
// Los PDF NO pasan por aqui: viven en IndexedDB dentro de la app.
var CACHE = "himnario-app-v1";
var ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./lib/pdf.min.js",
  "./lib/pdf.worker.min.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf("himnario-app-") === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Responde desde la copia guardada (rapido y sin internet) y, si hay red, la actualiza para la proxima vez
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(e.request, { ignoreSearch: true }).then(function (guardado) {
        var red = fetch(e.request).then(function (r) {
          if (r && r.ok) c.put(e.request, r.clone());
          return r;
        }).catch(function () { return guardado; });
        return guardado || red;
      });
    })
  );
});
