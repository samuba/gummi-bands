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
		this.reloadWithCacheBust();
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

		// Wait for any new service worker to activate
		await new Promise<void>((resolve) => {
			const waitForActivation = (worker: ServiceWorker) => {
				if (worker.state === 'activated') {
					resolve();
					return;
				}
				worker.addEventListener('statechange', () => {
					if (worker.state === 'activated') {
						resolve();
					}
				});
				// If it's waiting, tell it to skip
				if (worker.state === 'installed') {
					worker.postMessage({ type: 'SKIP_WAITING' });
				}
			};

			// Check if there's already a worker installing/waiting
			if (registration.installing) {
				waitForActivation(registration.installing);
				return;
			}
			if (registration.waiting) {
				waitForActivation(registration.waiting);
				return;
			}

			// Listen for new service worker (updatefound fires when SW starts installing)
			const onUpdateFound = () => {
				registration.removeEventListener('updatefound', onUpdateFound);
				clearTimeout(timeout);
				if (registration.installing) {
					waitForActivation(registration.installing);
				} else {
					resolve();
				}
			};
			registration.addEventListener('updatefound', onUpdateFound);

			// If no update found within 2 seconds, proceed anyway
			const timeout = setTimeout(() => {
				registration.removeEventListener('updatefound', onUpdateFound);
				resolve();
			}, 2000);
		});
	}
}

export const updater = new Updater();
