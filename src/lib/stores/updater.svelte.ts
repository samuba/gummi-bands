import { browser, version } from '$app/environment';
import { page, updated } from '$app/state';

const UPDATE_VERSION_KEY = 'app-update-version';
const UPDATE_FLAG_KEY = 'app-updating';
const UPDATE_ATTEMPTS_KEY = 'app-update-attempts';

class Updater {
	isUpdating = $state(false);

	setup() {
		if (!browser) return;

		// Check session storage FIRST, before setting up the effect
		// This prevents update loops when reloading after an update
		if (sessionStorage.getItem(UPDATE_FLAG_KEY) === 'true') {
			this.isUpdating = true;
			sessionStorage.removeItem(UPDATE_FLAG_KEY);
		}

		// Start polling for updates
		updated.check();

		// Check for updates when browser comes back online
		window.addEventListener('online', () => {
			console.log('Browser came online, checking for updates');
			updated.check();
		});

		// Watch for updates and trigger reload when on home screen
		$effect(() => {
			console.log('update effect', { updated: updated.current, routeId: page.route.id, isUpdating: this.isUpdating, version });
			if (updated.current && page.route.id === '/' && !this.isUpdating) {
				// Prevent tight loops, but DO allow retries (Safari/non-atomic deploys can need it)
				const lastUpdateVersion = sessionStorage.getItem(UPDATE_VERSION_KEY);
				if (lastUpdateVersion === version) {
					const attempts = Number(sessionStorage.getItem(UPDATE_ATTEMPTS_KEY) ?? '0');
					if (attempts >= 3) {
						console.warn('Update loop detected (max retries reached)');
						return;
					}

					console.warn('Update loop detected, retrying', { attempts });
					this.performUpdate();
					return;
				}
				this.performUpdate();
			}
		});
	}

	clearUpdating() {
		this.isUpdating = false;
		// Only clear the version tracking if we actually loaded a new version
		// This prevents loops when the service worker serves stale HTML
		if (browser) {
			const lastUpdateVersion = sessionStorage.getItem(UPDATE_VERSION_KEY);
			if (lastUpdateVersion && lastUpdateVersion !== version) {
				// Successfully updated to a new version
				sessionStorage.removeItem(UPDATE_VERSION_KEY);
				sessionStorage.removeItem(UPDATE_ATTEMPTS_KEY);
			}
		}
	}

	private async performUpdate() {
		console.log('Triggering app update from version', version);
		const attempts = Number(sessionStorage.getItem(UPDATE_ATTEMPTS_KEY) ?? '0') + 1;
		sessionStorage.setItem(UPDATE_FLAG_KEY, 'true');
		sessionStorage.setItem(UPDATE_ATTEMPTS_KEY, `${attempts}`);
		// Track which version we're updating FROM - if we're still on this version after
		// reload, we know the update failed and we're in a loop
		sessionStorage.setItem(UPDATE_VERSION_KEY, version);

		// Wait for the new service worker to take control before reloading
		// This ensures the reload is handled by the new SW and cached properly
		await this.waitForServiceWorker();
		await this.maybeHardResetSafari(attempts);
		this.reloadWithCacheBust();
	}

	private async maybeHardResetSafari(attempts: number) {
		// If Safari gets stuck serving the previous build after an update is detected,
		// we need a "last resort" that guarantees fresh assets.
		// Only do this when online and after at least one failed attempt.
		if (attempts < 2) return;
		if (!navigator.onLine) return;

		const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		if (!isSafari) return;

		console.warn('Safari hard-resetting SW + caches to complete update', { attempts });

		try {
			const registration = await navigator.serviceWorker.getRegistration();
			await registration?.unregister();
		} catch {
			// ignore
		}

		try {
			const keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k)));
		} catch {
			// ignore
		}
	}

	private reloadWithCacheBust() {
		const url = new URL(location.href);
		url.searchParams.set('__update', `${Date.now()}`);
		location.replace(url.toString());
	}

	private async waitForServiceWorker() {
		if (!('serviceWorker' in navigator)) return;

		const registration = await navigator.serviceWorker.getRegistration();
		if (!registration) return;

		// Force check for new service worker NOW (version.json change doesn't trigger SW update)
		try {
			await registration.update();
		} catch {
			// Might fail if offline
			return;
		}

		// Prefer waiting for the new worker to *control the page* (controllerchange),
		// especially on Safari where install/activate can take longer than expected.
		const controllerBefore = navigator.serviceWorker.controller;
		const controllerChange = new Promise<void>((resolve) => {
			const onControllerChange = () => {
				navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
				resolve();
			};
			navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
		});

		// If there is a waiting worker, request immediate activation.
		if (registration.waiting) {
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		}

		// If an installing worker transitions to installed, request skip waiting.
		if (registration.installing) {
			registration.installing.addEventListener('statechange', () => {
				if (registration.waiting) {
					registration.waiting.postMessage({ type: 'SKIP_WAITING' });
				}
			});
		}

		// If controller already changed, we're done.
		if (navigator.serviceWorker.controller && controllerBefore && navigator.serviceWorker.controller !== controllerBefore) {
			return;
		}

		// Otherwise, wait (bounded) for control to switch.
		await Promise.race([
			controllerChange,
			new Promise<void>((resolve) => setTimeout(resolve, 15000))
		]);
	}
}

export const updater = new Updater();
