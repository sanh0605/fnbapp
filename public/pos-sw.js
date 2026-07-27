// public/pos-sw.js
//
// Minimal, hand-written service worker scoped to the POS page only. Not a
// full PWA framework -- the need is narrow: let /pos open with no network,
// using the last successfully loaded version. See
// docs/superpowers/specs/2026-07-27-pos-offline-resilience-design.md
// (Component 3).

const CACHE_NAME = "pos-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isPosDocument = event.request.mode === "navigate" && url.pathname === "/pos";
  const isNextStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isNextStaticAsset) {
    // Content-hashed by Next.js's build -- never goes stale in a way that
    // matters, so serve from cache first and only hit the network on a
    // cache miss.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isPosDocument) {
    // Network-first: always prefer a fresh render when online (menu/price
    // changes should show up immediately), fall back to the last cached
    // render only when the network request fails outright.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw new Error("No cached /pos response available offline");
        }),
    );
  }
});
