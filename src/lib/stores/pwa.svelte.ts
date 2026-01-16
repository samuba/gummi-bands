import { browser, dev } from '$app/environment';

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);

export function setupPwa() {
	if (browser) {
		// Unregister service worker in development to avoid network interception
		if (dev && 'serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (const registration of registrations) {
					registration.unregister();
				}
			});
		}

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		});
	}
}

export async function installPwa() {
	if (!deferredPrompt) return;
	deferredPrompt.prompt();
	const { outcome } = await deferredPrompt.userChoice;
	if (outcome === 'accepted') {
		deferredPrompt = null;
	}
}

export function getPwaState() {
	return {
		get deferredPrompt() {
			return deferredPrompt;
		}
	};
}
