import { browser,version } from '$app/environment';
import { page, updated } from '$app/state';

class Updater {
	isUpdating = $state(false);

	setup() {
		if (!browser) return;

		$effect(() => {
			// Reload page when a new version is deployed, but only when user is on home screen
			console.log('effect in layout', { updated: updated.current, routeId: page.route.id, isUpdating: updater.isUpdating, version });
			if (browser && updated.current && page.route.id === '/' && !updater.isUpdating) {
				updater.performUpdate();
			}
		});

		updated.check();

		if (sessionStorage.getItem('app-updating') === 'true') {
			this.isUpdating = true;
			sessionStorage.removeItem('app-updating');
		}
	}

	clearUpdating() {
		this.isUpdating = false;
	}

	private async performUpdate() {
		console.log('Triggering app update');
		sessionStorage.setItem('app-updating', 'true');

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
