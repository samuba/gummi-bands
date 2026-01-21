import { browser, version } from '$app/environment';
import { page, updated } from '$app/state';

const UPDATE_VERSION_KEY = 'app-update-version';
const UPDATE_FLAG_KEY = 'app-updating';

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

		// Watch for updates and trigger reload when on home screen
		$effect(() => {
			console.log('update effect', { updated: updated.current, routeId: page.route.id, isUpdating: this.isUpdating, version });
			if (updated.current && page.route.id === '/' && !this.isUpdating) {
				// Prevent loops: don't update if we already tried updating to this version
				const lastUpdateVersion = sessionStorage.getItem(UPDATE_VERSION_KEY);
				if (lastUpdateVersion === version) {
					console.warn('Update loop detected - already on version', version);
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
			}
		}
	}

	private async performUpdate() {
		console.log('Triggering app update from version', version);
		sessionStorage.setItem(UPDATE_FLAG_KEY, 'true');
		// Track which version we're updating FROM - if we're still on this version after
		// reload, we know the update failed and we're in a loop
		sessionStorage.setItem(UPDATE_VERSION_KEY, version);

		// Wait for the new service worker to take control before reloading
		// This ensures the reload is handled by the new SW and cached properly
		await this.waitForServiceWorker();
		location.reload();
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
