// Denali Health — Service Worker
// BUMP ON DEPLOY: change version suffix to bust caches
const CACHE_VERSION = "v3";
const STATIC_CACHE = `denali-static-${CACHE_VERSION}`;
const API_CACHE = `denali-api-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install: precache critical assets ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: delete old versioned caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route-based caching strategies ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // 1. Network-only: real-time APIs and auth flows
  if (isNetworkOnly(url, request)) return;

  // 2. Cache-first: static assets (immutable after build)
  if (isCacheFirst(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. Network-first with cache fallback: cacheable API routes (GET only)
  if (isCacheableAPI(url, request)) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // 4. Navigation: network-first → cached shell → /offline
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // 5. Default: stale-while-revalidate for everything else
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ── Message handler: sync offline queue ──
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SYNC_QUEUE") {
    event.waitUntil(processOfflineQueue());
  }
});

// ── Route classification ──

function isNetworkOnly(url, request) {
  const path = url.pathname;
  // Chat API must always go to network (real-time streaming)
  if (path === "/api/chat") return true;
  // Auth & payment flows — never cache
  if (path.startsWith("/api/fhir/authorize")) return true;
  if (path.startsWith("/api/fhir/callback")) return true;
  if (path.startsWith("/api/checkout")) return true;
  if (path.startsWith("/api/webhooks")) return true;
  // POST/PUT/DELETE for non-GET APIs
  if (path.startsWith("/api/") && request.method !== "GET") return true;
  return false;
}

function isCacheFirst(url) {
  const path = url.pathname;
  if (path.startsWith("/_next/static/")) return true;
  if (/^\/(icon-|favicon|logo)/.test(path)) return true;
  return false;
}

function isCacheableAPI(url, request) {
  if (request.method !== "GET") return false;
  const path = url.pathname;
  const cacheableRoutes = [
    "/api/conversations",
    "/api/fhir/data",
    "/api/profile",
    "/api/diabetes/log",
    "/api/diabetes/insights",
  ];
  return cacheableRoutes.some((route) => path === route);
}

// ── Caching strategies ──

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      // Add header so client knows this is from cache
      const headers = new Headers(cached.headers);
      headers.set("X-From-SW-Cache", "true");
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try cached version of the page
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fall back to offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    return offlinePage || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cloned = response.clone();
        caches.open(cacheName).then((cache) => {
          cache.put(request, cloned);
        });
      }
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}

// ── Offline queue processing ──

async function processOfflineQueue() {
  // Open IndexedDB directly (can't import idb in SW)
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("denali-offline-cache", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return; // IndexedDB not available
  }

  try {
    const tx = db.transaction("offline-queue", "readonly");
    const store = tx.objectStore("offline-queue");
    const entries = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const entry of entries) {
      const item = entry.data;
      if (!item || item.retries >= 3) {
        // Drop after 3 retries
        await deleteQueueItem(db, entry.key);
        continue;
      }

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json" },
          body: item.body,
        });

        if (response.ok) {
          await deleteQueueItem(db, entry.key);
        } else {
          await incrementRetry(db, entry);
        }
      } catch {
        await incrementRetry(db, entry);
      }
    }
  } catch {
    // Queue processing failed — will retry on next online event
  } finally {
    db.close();
  }
}

function deleteQueueItem(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-queue", "readwrite");
    const store = tx.objectStore("offline-queue");
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function incrementRetry(db, entry) {
  return new Promise((resolve, reject) => {
    entry.data.retries = (entry.data.retries || 0) + 1;
    const tx = db.transaction("offline-queue", "readwrite");
    const store = tx.objectStore("offline-queue");
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
