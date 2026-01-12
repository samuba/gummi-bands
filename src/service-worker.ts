/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment.
// When we deploy a new version, this changes, so old caches get cleaned up.
const CACHE = `cache-${version}`;

// All assets known at build time.
// `build` = JS/CSS/WASM chunks (content-hashed, immutable)
// `files` = static files (favicon, manifest, etc.)
// `prerendered` = prerendered HTML pages (like /)
const PRECACHE = [...build, ...files, ...prerendered];

// Set for O(1) lookup of immutable assets
const IMMUTABLE = new Set(build);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			
			// Precache all known assets. If any fail, we continue anyway -
			// they'll be fetched on-demand later.
			await Promise.all(
				PRECACHE.map((path) =>
					cache.add(path).catch(() => {
						console.warn(`Failed to precache: ${path}`);
					})
				)
			);

			// Take over immediately, don't wait for old tabs to close
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Delete ALL old caches from previous deployments.
			// This is critical - we don't want stale assets mixing with new HTML.
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
			);

			// Take control of all open tabs immediately
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (!url.protocol.startsWith('http')) return;
	if (url.origin !== location.origin) return;

	event.respondWith(handleRequest(request, url));
});

async function handleRequest(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// STRATEGY 1: Immutable Assets (JS, CSS, WASM with content hashes)
	// These NEVER change for a given URL. Cache-first is always safe and fast.
	if (IMMUTABLE.has(url.pathname) || url.pathname.includes('/_app/immutable/')) {
		const cached = await cache.match(request);
		if (cached) return cached;

		// Not in cache (shouldn't happen if precache worked, but handle it)
		try {
			const response = await fetch(request);
			if (response.ok) {
				cache.put(request, response.clone());
			}
			return response;
		} catch {
			// This is bad - we need this asset but can't get it.
			// Return a 503 so the self-healing script in app.html can recover.
			return new Response('Service Unavailable', { status: 503 });
		}
	}

	// STRATEGY 2: Navigation Requests (HTML pages)
	// This is the tricky one. We need fresh HTML when online (to get correct JS hashes),
	// but cached HTML when offline (to work at all).
	if (request.mode === 'navigate') {
		// First, check if we're definitely offline
		if (!navigator.onLine) {
			const cached = await cache.match(request);
			if (cached) return cached;
			// No cache and offline - show fallback
			return offlinePage();
		}

		// We appear to be online, try the network
		try {
			const response = await fetch(request);
			if (response.ok) {
				// Cache the fresh HTML for offline use
				cache.put(request, response.clone());
				return response;
			}
			// Non-OK response (e.g., 500) - try cache
			const cached = await cache.match(request);
			if (cached) return cached;
			return response; // Return the error response
		} catch {
			// Network failed (probably offline despite navigator.onLine)
			const cached = await cache.match(request);
			if (cached) return cached;
			return offlinePage();
		}
	}

	// STRATEGY 3: Other Static Assets (images, fonts, etc.)
	// Cache-first for speed, network fallback for missing items.
	const cached = await cache.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok && response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response('Offline', { status: 503 });
	}
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
