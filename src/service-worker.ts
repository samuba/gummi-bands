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
			try {
				await cache.addAll([...ASSETS]);
			} catch {
				console.warn('Service worker: some assets failed to precache');
			}
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
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

	event.respondWith(respond(event.request));
});

async function respond(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);

	// 1. For navigation requests (the initial page load)
	// We use Network-First to avoid "white screen" caused by stale HTML
	if (request.mode === 'navigate') {
		try {
			const response = await fetch(request);
			if (response.ok) {
				cache.put(request, response.clone());
				return response;
			}
		} catch {
			// If network fails, try cache fallback
			const cached = await cache.match(request);
			if (cached) return cached;
			return offlineResponse();
		}
	}

	// 2. For all other assets (JS, CSS, WASM, images)
	// We use Cache-First for maximum speed and offline support
	const cached = await cache.match(request);
	if (cached) return cached;

	// 3. Fallback to network for assets not in cache
	try {
		const response = await fetch(request);
		if (response.ok && response.status === 200) {
			// Cache the new asset for next time
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
		<html lang="en">
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width,initial-scale=1">
			<title>Offline | Gummi Bands</title>
			<style>
				body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0D0D0D; color: #fff; text-align: center; padding: 20px; }
				h1 { margin: 0 0 1rem; font-size: 1.5rem; }
				p { color: #888; font-size: 1rem; }
			</style>
		</head>
		<body>
			<div>
				<h1>You're Offline</h1>
				<p>Please check your connection and try again.</p>
			</div>
		</body>
		</html>`,
		{ 
			status: 503, 
			headers: { 'Content-Type': 'text/html' } 
		}
	);
}
