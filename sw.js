// Sin conexión: guarda la app entera la primera vez. Con red, siempre sirve lo nuevo;
// lo guardado sólo sale si no hay red, así nunca se mezclan archivos de dos versiones.
const VERSION = "bs-3";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/main.js", "js/engine.js", "js/i18n.js", "js/chamber.js", "js/reference.js", "js/util.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "data/bestiary.json", "data/materials.json", "data/magic.json",
  "data/table-a.json", "data/table-b.json", "data/table-c.json", "data/table-d.json",
  "data/table-3-1.json", "data/table-3-2.json", "data/table-3-2-spark.json", "data/table-3-2-wall.json",
  "data/table-3-3.json", "data/table-3-4.json", "data/table-3-5.json", "data/table-3-6.json", "data/table-3-7.json",
  "data/table-3-8.json", "data/table-3-9.json", "data/table-3-10.json",
  "data/table-4-1.json", "data/table-4-2.json", "data/table-4-3.json", "data/table-4-4.json", "data/table-4-5.json",
  "data/table-4-6.json", "data/table-4-7.json", "data/table-4-8.json", "data/table-4-9.json",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero la red (sin la caché del navegador); si falla, lo guardado.
self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET" || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(caches.open(VERSION).then(async (cache) => {
    try {
      const res = await fetch(ev.request, { cache: "no-cache" });
      if (res.ok) cache.put(ev.request, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(ev.request, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  }));
});
