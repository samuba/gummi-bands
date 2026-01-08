import { browser } from '$app/environment';

class InitialLoader {
	text = $state('Initializing...');
	progress = $state(0);
	isLoading = $state(true);

	private targetProgress = 0;
	private internalProgress = 0;
	private animationFrame: number | null = null;
	private lastTime = 0;

	setLoading(text: string, percentage: number, targetPercentage?: number) {
		this.text = text;
		const clamped = Math.max(0, Math.min(100, percentage));
		this.progress = Math.round(clamped);
		this.internalProgress = clamped;

		if (targetPercentage !== undefined && browser) {
			this.targetProgress = Math.max(0, Math.min(100, targetPercentage));
			this.startApproaching();
		} else {
			this.stopApproaching();
		}
	}

	private startApproaching() {
		this.stopApproaching();
		this.lastTime = performance.now();

		const animate = (now: number) => {
			const elapsed = (now - this.lastTime) / 1000;
			this.lastTime = now;

			// Move 20% of remaining distance per second (smooth exponential approach)
			// Never reaches target - stops when setLoading or complete is called
			const diff = this.targetProgress - this.internalProgress;
			this.internalProgress += diff * 0.2 * elapsed;

			// Update displayed progress when it changes
			const rounded = Math.round(this.internalProgress);
			if (rounded !== this.progress && rounded < this.targetProgress) {
				this.progress = rounded;
			}

			this.animationFrame = requestAnimationFrame(animate);
		};

		this.animationFrame = requestAnimationFrame(animate);
	}

	private stopApproaching() {
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
	}

	complete() {
		this.stopApproaching();
		this.progress = 100;
		this.isLoading = false;
	}
}

export const loader = new InitialLoader();
