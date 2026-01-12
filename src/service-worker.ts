/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Unique cache name per deployment
const CACHE = `cache-${version}`;

// Only cache build assets (JS, CSS, WASM) and static files (images, fonts)
// We intentionally DO NOT cache HTML pages to prevent stale content issues
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
			.catch((err) => {
				console.warn('Precache failed:', err);
				return sw.skipWaiting();
			})
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

	// Only handle GET requests
	if (request.method !== 'GET') return;

	// Only handle same-origin requests
	const url = new URL(request.url);
	if (url.origin !== location.origin) return;

	// CRITICAL: Never intercept navigation requests (HTML pages)
	// This prevents the "white screen" issue caused by stale HTML serving old JS hashes
	// The browser will always fetch fresh HTML from the network
	if (request.mode === 'navigate') return;

	// For all other requests (JS, CSS, WASM, images), use cache-first
	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;

			return fetch(request).then((response) => {
				// Only cache successful responses
				if (response.ok && response.status === 200) {
					const clone = response.clone();
					caches.open(CACHE).then((cache) => cache.put(request, clone));
				}
				return response;
			});
		})
	);
});
