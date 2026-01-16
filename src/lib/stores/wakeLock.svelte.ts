import { browser } from '$app/environment';

class WakeLockStore {
	#wakeLock = $state<WakeLockSentinel | null>(null);
	#enabled = $state(true);

	get isSupported() {
		return browser && 'wakeLock' in navigator;
	}

	get isActive() {
		return this.#wakeLock !== null && !this.#wakeLock.released;
	}

	get enabled() {
		return this.#enabled;
	}

	set enabled(value: boolean) {
		this.#enabled = value;
		if (value) {
			this.request();
		} else {
			this.release();
		}
	}

	async request() {
		if (!browser || !this.isSupported || !this.#enabled) return;

		// Don't request if already active
		if (this.isActive) return;

		try {
			this.#wakeLock = await navigator.wakeLock.request('screen');
			this.#wakeLock.addEventListener('release', () => {
				this.#wakeLock = null;
			});
		} catch (err) {
			// Wake lock request failed - usually due to visibility state or low battery
			console.warn('Wake lock request failed:', err);
		}
	}

	async release() {
		if (this.#wakeLock && !this.#wakeLock.released) {
			await this.#wakeLock.release();
			this.#wakeLock = null;
		}
	}

	// Re-acquire wake lock when document becomes visible (it gets released when page is hidden)
	handleVisibilityChange() {
		if (!browser) return;
		if (document.visibilityState === 'visible' && this.#enabled) {
			this.request();
		}
	}

	initialize(enabled: boolean) {
		this.#enabled = enabled;
		
		if (!browser) return;

		// Set up visibility change listener
		document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

		// Request wake lock if enabled
		if (enabled) {
			this.request();
		}
	}
}

export const wakeLock = new WakeLockStore();
