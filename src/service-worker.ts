/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/* Specification:
	- Most Important:This implementation should be as robust as possible, so that there is never a situation where clients dont receive updates anymore because of caching.
	- Updates should be possible and seamless via implementation in updater.svelte.ts
	- Should be able to handle offline scenarios and network failures gracefully.
	- Specifically should be able to show offline version after update got installed without manual browser refresh.
	- When using cached version, should always use latest cached version
	- All of the above can have different behaviour in chrome vs safari. Safari is especially tricky, make sure to account for that.
*/

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Cache per deployment.
// IMPORTANT: we intentionally keep older caches to avoid "white screen" situations
// during/after updates when a stale HTML document references old hashed JS files
// that are no longer available on the server/CDN.
const CACHE = `assets-${version}`;

// Precache all build assets and static files
// JS files are handled specially in fetch handler for update robustness
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	// IMPORTANT: never let a single missing/404 asset prevent the new service worker
	// from installing/activating. `cache.addAll()` fails the whole install if any
	// request fails, which can brick updates on Safari (and during non-atomic deploys).
	event.waitUntil((async () => {
		const cache = await caches.open(CACHE);

		await Promise.allSettled(
			ASSETS.map(async (asset) => {
				try {
					// Ensure we don't pull from HTTP cache during an update.
					const request = new Request(asset, { cache: 'reload' });
					const response = await fetch(request);
					if (!response.ok) return;
					await cache.put(request, response);
				} catch {
					// Best-effort: ignore individual failures.
				}
			})
		);

		await sw.skipWaiting();
	})());
});

sw.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		// Do NOT aggressively delete old caches here.
		// If we delete old caches, a client that still has an older HTML document
		// can end up requesting old hashed JS files that 404 on the network and are
		// no longer available in Cache Storage, causing a hard-brick white screen.
		await sw.clients.claim();

		// Ensure the app shell is available offline *immediately* after an update installs.
		// iOS PWA users often update while online, then later open the app offline without
		// having done a manual refresh — this warm-up prevents an "You're Offline" lockout.
		await warmAppShell();

		// Keep storage bounded while still keeping enough history to safely recover from
		// non-atomic deploys and Safari edge cases.
		await cleanupOldAssetCaches(12);
	})());
});

// Allow pages to tell a waiting service worker to activate immediately
sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;

	// Never cache or serve version.json from cache - always fetch fresh for update checks
	if (url.pathname === '/_app/version.json') return;

	// JavaScript modules: network-first, but FALL BACK TO CACHE on 404/error.
	// This is critical for Safari robustness during updates:
	// an older HTML document can reference old hashed JS filenames that temporarily/permanently
	// 404 on the network during/after deployments. Serving from Cache Storage prevents a hard
	// white-screen brick, and the updater flow can retry and move the client forward.
	if (url.pathname.endsWith('.js') || request.destination === 'script') {
		event.respondWith((async () => {
			const cached = await matchFromLatestAssetCache(request);

			try {
				const response = await fetch(request);

				// If the network serves the file, refresh the cache for offline use.
				if (response.ok) {
					const responseClone = response.clone();
					void caches.open(CACHE).then((cache) => cache.put(request, responseClone));
					return response;
				}

				// If the network 404s but we have a cached copy, serve it.
				// This avoids module import failures and white screens.
				if (response.status === 404 && cached) return cached;

				return response;
			} catch {
				// Network failed. Serve cached if possible.
				if (cached) return cached;
				return new Response('', { status: 503 });
			}
		})());
		return;
	}

	// Navigation: try network first, only use cache if network fails (offline support)
	if (request.mode === 'navigate') {
		const normalized = normalizeNavigationRequest(request);
		event.respondWith(
			// Always force a fresh HTML document when online to avoid stale HTML referencing
			// removed hashed assets (common cause of Safari update white-screens).
			fetch(new Request(request.url, { cache: 'no-store' }))
				.then((response) => {
					// Cache successful HTML for offline startup.
					// Use a normalized key (strip search params like __update) so offline launches
					// can still find the cached app shell.
					if (response.ok) {
						const responseClone = response.clone();
						void caches.open(CACHE).then((cache) => cache.put(normalized, responseClone));
					}
					return response;
				})
				.catch(() => handleOfflineNavigation(request))
		);
		return;
	}

	// Other assets (CSS/images/fonts/etc):
	// Use cache-first with network fallback, and populate cache on successful network responses.
	// This avoids relying on `navigator.onLine` (which is unreliable on iOS PWAs) and ensures
	// offline startups work consistently after updates.
	event.respondWith((async () => {
		const cached = await matchFromLatestAssetCache(request);
		if (cached) return cached;

		try {
			const response = await fetch(request);
			if (response.ok) {
				const responseClone = response.clone();
				void caches.open(CACHE).then((cache) => cache.put(request, responseClone));
			}
			return response;
		} catch {
			return new Response('', { status: 503 });
		}
	})());
	return;

	// Online: don't intercept, let browser fetch directly
	// Browser will use HTTP caching naturally (SvelteKit assets have long cache headers)
});

function normalizeNavigationRequest(request: Request): Request {
	const url = new URL(request.url);
	url.search = '';
	url.hash = '';
	return new Request(url.toString(), { method: 'GET' });
}

async function handleOfflineNavigation(request: Request): Promise<Response> {
	const normalized = normalizeNavigationRequest(request);
	// Prefer the newest cached app shell first (Chrome can otherwise pick a very old cache).
	// Fall back to older caches only if the newest doesn't have the request.
	const cached = (await matchFromLatestAssetCache(normalized)) ?? (await matchFromLatestAssetCache(request));
	if (cached) return cached;

	// For the home page, try to serve a basic offline version
	if (normalized.url === location.origin + '/' || normalized.url === location.origin) {
		return offlineAppPage();
	}

	// No cache available - show offline page
	return offlinePage();
}

function parseAssetCacheVersion(key: string): number | null {
	// Cache names are `assets-${version}` where version is a unix timestamp string
	if (!key.startsWith('assets-')) return null;
	const raw = key.slice('assets-'.length);
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

async function matchFromLatestAssetCache(request: Request): Promise<Response | undefined> {
	const keys = await caches.keys();
	const assetKeys = keys
		.map((key) => ({ key, v: parseAssetCacheVersion(key) }))
		.filter((x): x is { key: string; v: number } => x.v !== null)
		.sort((a, b) => b.v - a.v)
		.map((x) => x.key);

	for (const key of assetKeys) {
		const cache = await caches.open(key);
		const match = await cache.match(request);
		if (match) return match;
	}

	return undefined;
}

async function warmAppShell() {
	try {
		const request = new Request(location.origin + '/', { cache: 'no-store' });
		const response = await fetch(request);
		if (!response.ok) return;
		const normalized = normalizeNavigationRequest(request);
		const responseClone = response.clone();
		const cache = await caches.open(CACHE);
		await cache.put(normalized, responseClone);
	} catch {
		// If offline or fetch fails, ignore — offline will use previous cached shells if available.
	}
}

async function cleanupOldAssetCaches(keepLatest: number) {
	if (keepLatest <= 0) return;

	const keys = await caches.keys();
	const assetCaches = keys
		.map((key) => ({ key, v: parseAssetCacheVersion(key) }))
		.filter((x): x is { key: string; v: number } => x.v !== null)
		.sort((a, b) => b.v - a.v);

	const toDelete = assetCaches.slice(keepLatest).map((x) => x.key);
	await Promise.allSettled(toDelete.map((key) => caches.delete(key)));
}

function offlineAppPage(): Response {
	return new Response(
		`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="icon" href="/icon.png" type="image/png">
	<link rel="manifest" href="/manifest.json">
	<meta name="theme-color" content="#0D0D0D">
	<title>Gummi Bands - Workout Tracker</title>
	<style>
		* { box-sizing: border-box; }
		body {
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			padding: 24px;
			background: #0D0D0D;
			color: #fff;
		}
		.container { text-align: center; max-width: 300px; }
		h1 { margin: 0 0 12px; font-size: 24px; font-weight: 600; }
		p { margin: 0 0 24px; color: #888; font-size: 16px; line-height: 1.5; }
		button {
			background: #fff;
			color: #0D0D0D;
			border: none;
			padding: 12px 24px;
			border-radius: 8px;
			font-size: 16px;
			font-weight: 500;
			cursor: pointer;
		}
		button:active { opacity: 0.8; }
		.spinner {
			width: 40px;
			height: 40px;
			border: 3px solid #333;
			border-top: 3px solid #fff;
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin: 0 auto 16px;
		}
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
		.hidden { display: none; }
	</style>
</head>
<body>
	<div class="container">
		<div id="loading">
			<div class="spinner"></div>
			<h1>Loading Offline</h1>
			<p>Your workout data is stored locally. The app will load shortly.</p>
		</div>
		<div id="offline" class="hidden">
			<h1>You're Offline</h1>
			<p>The app needs to be loaded online at least once before it can work offline.</p>
			<button onclick="location.reload()">Retry</button>
		</div>
	</div>
	<script>
		(function() {
			var RELOAD_KEY = 'offline-reload-attempt';
			var reloadAttempt = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
			
			// If we've already tried reloading, show the offline message
			if (reloadAttempt >= 1) {
				sessionStorage.removeItem(RELOAD_KEY);
				document.getElementById('loading').classList.add('hidden');
				document.getElementById('offline').classList.remove('hidden');
				return;
			}
			
			// If service worker is available, try one reload
			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.ready.then(function() {
					sessionStorage.setItem(RELOAD_KEY, String(reloadAttempt + 1));
					setTimeout(function() {
						window.location.reload();
					}, 500);
				}).catch(function() {
					document.getElementById('loading').classList.add('hidden');
					document.getElementById('offline').classList.remove('hidden');
				});
			} else {
				document.getElementById('loading').classList.add('hidden');
				document.getElementById('offline').classList.remove('hidden');
			}
		})();
	</script>
</body>
</html>`,
		{
			status: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		}
	);
}

function offlinePage(): Response {
	return new Response(
		`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#0D0D0D">
	<title>Offline | Gummi Bands</title>
	<style>
		* { box-sizing: border-box; }
		body {
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			padding: 24px;
			background: #0D0D0D;
			color: #fff;
		}
		.container { text-align: center; max-width: 300px; }
		h1 { margin: 0 0 12px; font-size: 24px; font-weight: 600; }
		p { margin: 0 0 24px; color: #888; font-size: 16px; line-height: 1.5; }
		button {
			background: #fff;
			color: #0D0D0D;
			border: none;
			padding: 12px 24px;
			border-radius: 8px;
			font-size: 16px;
			font-weight: 500;
			cursor: pointer;
		}
		button:active { opacity: 0.8; }
	</style>
</head>
<body>
	<div class="container">
		<h1>You're Offline</h1>
		<p>Check your internet connection and try again.</p>
		<button onclick="location.reload()">Retry</button>
	</div>
</body>
</html>`,
		{
			status: 503,
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		}
	);
}
