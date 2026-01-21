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

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;

	// Never cache or serve version.json from cache - always fetch fresh
	if (url.pathname === '/version.json') return;

	// Navigation: network-first with timeout, fallback to cache
	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request));
		return;
	}

	// Assets: cache-first for speed
	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;

			return fetch(request).then((response) => {
				if (response.ok) {
					const clone = response.clone();
					caches.open(CACHE).then((cache) => cache.put(request, clone));
				}
				return response;
			});
		})
	);
});

async function handleNavigation(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);

	// Race between network fetch and timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

	try {
		const response = await fetch(request, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (response.ok) {
			// Cache the fresh HTML for offline use
			cache.put(request, response.clone());
			return response;
		}

		// Non-OK response, try cache
		const cached = await cache.match(request);
		return cached ?? response;
	} catch {
		clearTimeout(timeoutId);

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
	</style>
</head>
<body>
	<div class="container">
		<div class="spinner"></div>
		<h1>Loading Offline</h1>
		<p>Your workout data is stored locally. The app will load shortly.</p>
	</div>
	<script>
		// If service worker is available, try to load the app
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js')
				.then(() => {
					// Try to reload the page to get the cached version
					setTimeout(() => {
						window.location.reload();
					}, 1000);
				})
				.catch(() => {
					// If service worker fails, show offline message
					document.querySelector('.container').innerHTML = \`
						<h1>You're Offline</h1>
						<p>Check your internet connection and try again.</p>
						<button onclick="location.reload()">Retry</button>
					\`;
				});
		}
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
