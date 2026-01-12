/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// NUCLEAR RESET: This service worker clears all caches and unregisters itself.
// Deploy this to fix users stuck with broken service workers.
// After deploying this, deploy the real service worker.

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => {
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Delete ALL caches
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));

			// Take control
			await sw.clients.claim();

			// Tell all clients to reload
			const clients = await sw.clients.matchAll({ type: 'window' });
			clients.forEach((client) => {
				client.postMessage({ type: 'RELOAD' });
			});

			// Unregister this service worker
			await sw.registration.unregister();
		})()
	);
});

// Don't intercept any requests - let everything go to network
sw.addEventListener('fetch', () => {
	return;
});
