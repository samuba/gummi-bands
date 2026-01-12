/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Assets that are part of the build (JS, CSS, WASM, etc.)
const ASSETS = new Set([...build, ...files, ...prerendered]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			
			// Try to cache everything, but don't fail the whole install if some fail
			// We wrap each in a promise to handle errors individually if needed, 
			// but for now we'll just try to cache them all and let it fail gracefully.
			try {
				await cache.addAll([...ASSETS]);
			} catch (err) {
				console.error('Service worker precaching failed:', err);
				// Still skip waiting to let the worker activate and try caching on demand
			}
			
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Delete old caches from previous deployments
			for (const key of await caches.keys()) {
				if (key !== CACHE) {
					await caches.delete(key);
				}
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (!url.protocol.startsWith('http')) return;

	// Skip cross-origin requests
	if (url.origin !== location.origin) return;

	event.respondWith(respond(event.request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// 1. Try to find an exact match in the cache
	const cached = await cache.match(request);
	
	// 2. If it's an immutable asset, return cached or fetch once
	if (url.pathname.includes('/_app/immutable/')) {
		if (cached) return cached;
		
		try {
			const response = await fetch(request);
			if (response.ok) cache.put(request, response.clone());
			return response;
		} catch {
			// If it's an immutable asset and we can't get it, we're in trouble
			return new Response('Asset not found', { status: 404 });
		}
	}

	// 3. For navigation requests
	if (request.mode === 'navigate') {
		// If definitely offline, return cached or offline page
		if (!navigator.onLine) {
			return cached ?? offlineResponse();
		}

		// If we have a cached version, return it but update in background
		if (cached) {
			fetch(request)
				.then((response) => {
					if (response.ok) cache.put(request, response.clone());
				})
				.catch(() => {});
			return cached;
		}

		// No cache - try network with a timeout for "lie-fi"
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 4000);

		try {
			const response = await fetch(request, { signal: controller.signal });
			clearTimeout(timeoutId);
			if (response.ok) cache.put(request, response.clone());
			return response;
		} catch {
			clearTimeout(timeoutId);
			return offlineResponse();
		}
	}

	// 4. For other assets (JS, CSS, static files)
	if (cached) return cached;

	// Fallback to network
	try {
		const response = await fetch(request);
		if (response.ok && response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response('Not found', { status: 404 });
	}
}

function offlineResponse() {
	return new Response(
		`<!DOCTYPE html>
		<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
		<title>Offline</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0D0D0D;color:#fff}
		div{text-align:center}h1{margin:0 0 .5rem}</style></head>
		<body><div><h1>Offline</h1><p>Please check your connection</p></div></body></html>`,
		{ status: 503, headers: { 'Content-Type': 'text/html' } }
	);
}
