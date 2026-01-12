/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Assets that are part of the build (JS, CSS, WASM, etc.)
const ASSETS = new Set([
	...build,
	...files
]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// Cache all build assets and static files
			await cache.addAll([...ASSETS]);
			// Activate immediately without waiting for tabs to close
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
			// Take control of all clients immediately
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	// Only handle GET requests
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip caching for non-http(s) requests (like chrome-extension://)
	if (!url.protocol.startsWith('http')) return;

	event.respondWith(respond(event.request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// For known build/static assets, always serve from cache first (cache-first strategy)
	// These are immutable and versioned, so cache is always correct
	if (ASSETS.has(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) {
			return cached;
		}
	}

	// For immutable assets (content-hashed), use cache-first with network fallback
	if (url.pathname.includes('/_app/immutable/')) {
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}
		
		// Not in cache, fetch and cache it
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	}

	// For HTML pages and other requests, use network-first with cache fallback
	// This ensures users get fresh content when online
	try {
		const response = await fetch(request);

		// Only cache successful responses
		if (response.ok && response.status === 200) {
			// Don't cache API responses or external requests
			if (url.origin === location.origin) {
				cache.put(request, response.clone());
			}
		}

		return response;
	} catch {
		// Network failed, try cache
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}

		// Nothing in cache either, return a basic offline response for navigations
		if (request.mode === 'navigate') {
			return new Response(
				'<html><body><h1>Offline</h1><p>Please check your connection and try again.</p></body></html>',
				{
					status: 503,
					headers: { 'Content-Type': 'text/html' }
				}
			);
		}

		throw new Error(`Network request failed for ${url.pathname}`);
	}
}
