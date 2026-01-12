/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Assets that are part of the build (JS, CSS, WASM, etc.)
// Include prerendered pages (like /) so they load instantly offline
const ASSETS = new Set([...build, ...files, ...prerendered]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([...ASSETS]);
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

	// 1. Check if it's a precached asset (JS, CSS, or PRERENDERED HTML like /)
	// These are served INSTANTLY from cache.
	if (ASSETS.has(url.pathname)) {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	// 2. For immutable assets (content-hashed) - cache-first
	if (url.pathname.includes('/_app/immutable/')) {
		const cached = await cache.match(request);
		if (cached) return cached;

		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	}

	// 3. For HTML/navigation
	if (request.mode === 'navigate') {
		const cached = await cache.match(request);

		// If we are definitely offline, return cached or offline page immediately
		if (!navigator.onLine) {
			return cached ?? offlineResponse();
		}

		if (cached) {
			// Stale-while-revalidate: return cached, update in background
			fetch(request)
				.then((response) => {
					if (response.ok) cache.put(request, response.clone());
				})
				.catch(() => {});
			return cached;
		}

		// Cache miss + Online: try network with a timeout for "lie-fi"
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);

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

	// 4. For everything else (API, etc.) - network-first
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw new Error(`Failed to fetch ${url.pathname}`);
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

