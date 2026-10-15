// public/pos-sw.js
//
// Kill switch. The till no longer works offline (BR-SALE-015), but tills that
// registered the old worker keep it until the browser re-checks this script,
// and a 404 does not reliably remove it. This version deletes every cache and
// unregisters itself. No fetch handler: requests go straight to the network.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister()),
  );
});
