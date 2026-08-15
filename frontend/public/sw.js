// Service worker de Solventa.
// Objetivo: que la carga inicial sea más rápida en visitas repetidas
// cacheando los archivos estáticos (HTML, CSS, JS e íconos).
// La app necesita internet para hablar con el backend, así que no hay
// modo offline completo: si la red falla y hay caché, se sirve lo cacheado.
const CACHE_NAME = "solventa-static-v1";
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar peticiones a la API ni de otros orígenes.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) {
    return;
  }
  if (request.method !== "GET") return;

  // Navegaciones: network-first (siempre intenta la versión fresca del HTML).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Estáticos: cache-first, actualizando la caché en segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
