// Guarda la app para que funcione sin internet.
// Los PDF NO pasan por aqui: viven en IndexedDB dentro de la app.
var CACHE = "himnario-app-v2";
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
// ---------- RECIBIR PDF COMPARTIDOS DESDE "ARCHIVOS" ----------
function abrirDB() {
  return new Promise(function (ok, mal) {
    var r = indexedDB.open("himnario", 2);
    r.onupgradeneeded = function () {
      var d = r.result;
      if (!d.objectStoreNames.contains("pdfs")) d.createObjectStore("pdfs");
      if (!d.objectStoreNames.contains("pendientes")) d.createObjectStore("pendientes");
    };
    r.onsuccess = function () { ok(r.result); };
    r.onerror = function () { mal(r.error); };
  });
}

function esPdf(f) {
  return f && typeof f === "object" && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
}

function recibirCompartidos(req) {
  var volver = function (q) { return Response.redirect(new URL("./?compartido=" + q, self.registration.scope).href, 303); };
  return req.formData().then(function (fd) {
    var archivos = fd.getAll("pdfs").filter(esPdf);
    return abrirDB().then(function (d) {
      return new Promise(function (ok, mal) {
        var tx = d.transaction("pendientes", "readwrite");
        var s = tx.objectStore("pendientes");
        archivos.forEach(function (f) { s.put(f, (f.name || "himno").replace(/\.pdf$/i, "")); });
        tx.oncomplete = function () { d.close(); ok(archivos.length); };
        tx.onerror = tx.onabort = function () { d.close(); mal(tx.error); };
      });
    });
  }).then(function (n) { return volver(n); })
    .catch(function () { return volver("error"); });
}

self.addEventListener("fetch", function (e) {
  if (e.request.method === "POST" && new URL(e.request.url).pathname.slice(-10) === "/compartir") {
    e.respondWith(recibirCompartidos(e.request));
    return;
  }
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
