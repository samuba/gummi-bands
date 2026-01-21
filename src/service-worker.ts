/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Unique cache per deployment - old caches are cleaned up on activate
const CACHE = `assets-${version}`;

// Only precache build assets (JS, CSS, WASM) and static files
// HTML pages are cached on-demand after successful fetches
const ASSETS = [...build, ...files];

// Timeout for network requests before falling back to cache
const NETWORK_TIMEOUT = 5000;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(
				keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
			))
			.then(() => sw.clients.claim())
	);
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

	// Respect hard refresh (Cmd+Shift+R) - bypass service worker entirely
	// request.cache will be 'reload' for hard refresh
	if (request.cache === 'reload') return;

	// Navigation: network-first with timeout, fallback to cache
	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request));
		return;
	}

	// Assets: cache-first for speed, but network-first if hard refreshing
	event.respondWith(handleAsset(request));
});

async function handleAsset(request: Request): Promise<Response> {
	// Check cache first
	const cached = await caches.match(request);
	if (cached) return cached;

	// Not in cache, fetch from network
	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(CACHE);
		cache.put(request, response.clone());
	}
	return response;
}

async function handleNavigation(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);

	// For refresh requests, always try network first without timeout
	// This ensures manual refresh always gets fresh content
	const isRefresh = request.cache === 'reload' || 
		request.headers.get('Cache-Control')?.includes('no-cache');

	// Race between network fetch and timeout (skip timeout for refresh)
	const controller = new AbortController();
	const timeoutId = isRefresh ? null : setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

	try {
		// Always fetch navigation requests from network, bypassing HTTP cache
		// This ensures we always get the latest HTML from the server
		const response = await fetch(request, { 
			signal: controller.signal,
			cache: 'no-store'  // Bypass browser HTTP cache
		});
		if (timeoutId) clearTimeout(timeoutId);

		if (response.ok) {
			// Cache the fresh HTML for offline use
			cache.put(request, response.clone());
			return response;
		}

		// Non-OK response, try cache
		const cached = await cache.match(request);
		return cached ?? response;
	} catch {
		if (timeoutId) clearTimeout(timeoutId);

		// Network failed or timed out - serve from cache
		const cached = await cache.match(request);
		if (cached) return cached;

		// For the home page, try to serve a basic offline version that still loads the app
		if (request.url === location.origin + '/' || request.url === location.origin) {
			return offlineAppPage();
		}

		// No cache available - show offline page
		return offlinePage();
	}
}

function offlineAppPage(): Response {
	return new Response(
		`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
