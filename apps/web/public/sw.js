
const CACHE_NAME = "multillm-v1";

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // Only handle GET requests — skip everything else
    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request).catch(() =>
            caches.match(event.request).then(
                (cached) => cached ?? new Response("Offline", { status: 503 })
            )
        )
    );
});