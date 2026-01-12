/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
const ASSETS = new Set([...build, ...files]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => {
			return cache.addAll([...ASSETS]).catch(() => {
				console.warn('Service worker: some assets failed to precache');
			});
		}).then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
		}).then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (!url.protocol.startsWith('http')) return;
	if (url.origin !== location.origin) return;

	// For navigation (HTML), always try network first with a timeout
	if (event.request.mode === 'navigate') {
		event.respondWith(networkFirstWithTimeout(event.request, 3000));
		return;
	}

	// For assets, try cache first
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;

			return fetch(event.request).then((response) => {
				if (response.ok && response.status === 200) {
					const cacheCopy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, cacheCopy));
				}
				return response;
			});
		})
	);
});

async function networkFirstWithTimeout(request: Request, timeout: number): Promise<Response> {
	const cache = await caches.open(CACHE);

	try {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(request, { signal: controller.signal });
		clearTimeout(id);

		if (response.ok) {
			cache.put(request, response.clone());
			return response;
		}
	} catch {
		// Network failed or timed out, try cache
		const cached = await cache.match(request);
		if (cached) return cached;
	}

	return new Response('Offline', { status: 503 });
}
