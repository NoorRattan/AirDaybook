/* airdaybookBuild is injected by the production build. */
const prefix = "airdaybook-shell-";
const cacheName = prefix + airdaybookBuild.version;
const metadataCache = "airdaybook-offline-metadata";
const activeCacheKey = "/.well-known/airdaybook-active-cache";
const routes = new Set(airdaybookBuild.routes);
const assets = new Set(airdaybookBuild.entries.map(([url]) => url).filter((url) => !routes.has(url)));

function appCaches() {
  return caches.keys().then((names) => names.filter((name) => name.startsWith(prefix)));
}

function cacheShell() {
  return stage ??= (async () => {
    const cache = await caches.open(cacheName);
    try {
      await cache.addAll(airdaybookBuild.entries.map(([url, integrity]) => new Request(url, {
        cache: "reload", credentials: "omit", mode: "same-origin", redirect: "error", integrity,
      })));
    } catch (error) {
      // addAll is atomic. Keep an already-complete cache available for rollback.
      if ((await cache.keys()).length === 0) await caches.delete(cacheName);
      throw error;
    }
  })().finally(() => { stage = undefined; });
}

let stage;
self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const metadata = await caches.open(metadataCache);
    const last = await (await metadata.match(activeCacheKey))?.text();
    await metadata.put(activeCacheKey, new Response(cacheName));
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.length <= 1) {
      const previousCaches = (await appCaches()).filter((name) => name !== cacheName);
      const previous = last && previousCaches.includes(last) ? last : previousCaches.at(-1);
      await Promise.all(previousCaches.filter((name) => name !== previous).map((name) => caches.delete(name)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(self.skipWaiting());
  if (["CACHE_STATUS", "REPAIR_CACHE"].includes(event.data?.type) && event.ports[0]) {
    event.waitUntil((async () => {
      if (event.data.type === "REPAIR_CACHE") {
        try { await cacheShell(); } catch { /* Report the cache that actually remains. */ }
      }
      const cache = await caches.open(cacheName);
      const ready = (await cache.keys()).length === airdaybookBuild.entries.length;
      event.ports[0].postMessage({ ready });
    })());
  }
});

async function fromShell(path) {
  return caches.open(cacheName).then((cache) => cache.match(path));
}

async function navigation(request, path) {
  const saved = await fromShell(path);
  if (saved) return saved;
  try {
    return await fetch(request);
  } catch {
    return new Response("AirDaybook’s offline files are unavailable. Reconnect and reopen the app to save them again.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

async function appRouterRequest(request, path) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(3500) });
    if (response.ok) return response;
  } catch {
    // An HTML response asks the App Router to fall back to document navigation.
  }
  return navigation(request, path);
}

async function staticAsset(request, path) {
  const saved = await fromShell(path);
  if (saved) return saved;
  if (path.startsWith("/_next/static/")) {
    const prior = (await appCaches()).filter((name) => name !== cacheName).reverse();
    for (const name of prior) {
      const olderAsset = await caches.match(path, { cacheName: name });
      if (olderAsset) return olderAsset;
    }
    return fetch(request, { credentials: "omit", mode: "same-origin", redirect: "error" });
  }
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (routes.has(path) && request.mode === "navigate") {
    event.respondWith(navigation(request, path));
  } else if (routes.has(path) && request.headers.get("RSC") === "1") {
    event.respondWith(appRouterRequest(request, path));
  } else if (assets.has(path) || path.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request, path));
  }
});
